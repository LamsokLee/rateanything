/**
 * BullMQ processor: recalculates avg_rating and rating_count for a given option.
 * Triggered whenever a new rating is submitted or an existing one is updated/deleted.
 */
import { Job } from 'bullmq';
import { db, options, ratings, eq, avg, count } from '@rateanything/db';

export interface RecalculateScorePayload {
  optionId: string;
}

export async function recalculateScore(job: Job<RecalculateScorePayload>) {
  const { optionId } = job.data;

  // Calculate fresh aggregate stats from all ratings for this option
  const [stats] = await db
    .select({
      avgRating: avg(ratings.score),
      ratingCount: count(ratings.id),
    })
    .from(ratings)
    .where(eq(ratings.optionId, optionId));

  // Update the option's denormalized aggregate fields
  await db
    .update(options)
    .set({
      avgRating: stats.avgRating ? parseFloat(String(stats.avgRating)) : 0,
      ratingCount: stats.ratingCount,
    })
    .where(eq(options.id, optionId));

  return { optionId, avgRating: stats.avgRating, ratingCount: stats.ratingCount };
}
