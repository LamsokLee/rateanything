/**
 * BullMQ processor: recalculates trending_score for topics.
 * Uses a time-decay formula: score = total_ratings / (hours_since_last_activity + 2)^1.5
 * This balances popularity with recency.
 */
import { Job } from 'bullmq';
import { db, topics, eq, sql } from '@rateanything/db';

export interface UpdateTrendingPayload {
  topicId: string;
}

export async function updateTrending(job: Job<UpdateTrendingPayload>) {
  const { topicId } = job.data;

  // Gravity-based trending formula inspired by Hacker News
  // score = total_ratings / (hours_since_last_activity + 2) ^ 1.5
  await db
    .update(topics)
    .set({
      trendingScore: sql`
        total_ratings::real / POWER(
          EXTRACT(EPOCH FROM (NOW() - last_activity)) / 3600.0 + 2,
          1.5
        )
      `,
    })
    .where(eq(topics.id, topicId));

  return { topicId, status: 'updated' };
}
