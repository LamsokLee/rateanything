/**
 * Ratings router — submit and retrieve ratings for options.
 */
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, publicProcedure, protectedProcedure } from '../trpc';
import { rateLimit } from '../rate-limit';
import {
  db, ratings, options, topics, users, guests,
  eq, and, sql, desc,
} from '@rateanything/db';

export const ratingsRouter = router({
  /** Submit a rating for an option (auth or guest fingerprint required) */
  submit: publicProcedure
    .use(rateLimit("ratings.submit", 30, 3600))
    .input(z.object({
      optionId: z.string().uuid(),
      score: z.number().int().min(1).max(10),
      comment: z.string().max(1000).optional(),
      tags: z.array(z.string().max(30)).max(5).optional(),
      guestFingerprint: z.string().max(64).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { optionId, score, comment, tags, guestFingerprint } = input;

      // Verify the option exists
      const [option] = await db
        .select({ id: options.id, topicId: options.topicId })
        .from(options)
        .where(eq(options.id, optionId))
        .limit(1);

      if (!option) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Option not found' });
      }

      // Determine if rating as authenticated user or guest
      let userId: string | null = null;
      let guestId: string | null = null;

      if (ctx.auth?.userId) {
        // Authenticated user - look up internal user ID
        const [user] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.clerkId, ctx.auth.userId))
          .limit(1);

        if (!user) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
        }
        userId = user.id;
      } else if (guestFingerprint) {
        // Guest user - find or create guest record
        const [existingGuest] = await db
          .select({ id: guests.id })
          .from(guests)
          .where(eq(guests.fingerprintHash, guestFingerprint))
          .limit(1);

        if (existingGuest) {
          guestId = existingGuest.id;
        } else {
          const [newGuest] = await db
            .insert(guests)
            .values({ fingerprintHash: guestFingerprint })
            .returning({ id: guests.id });
          guestId = newGuest.id;
        }
      } else {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Authentication or guest fingerprint required',
        });
      }

      // Perform upsert + synchronous score recalculation in a single transaction.
      // This replaces the intended async BullMQ recalculation (workers never ran).
      const result = await db.transaction(async (tx) => {
        // Guest rate-limit: max 3 distinct topics (changing vote on already-rated topic is OK)
        if (guestId) {
          const GUEST_TOPIC_LIMIT = 3;
          // Check if this guest already rated this topic (via any option on this topic)
          const [existingForTopic] = await tx
            .select({ id: ratings.id })
            .from(ratings)
            .innerJoin(options, eq(ratings.optionId, options.id))
            .where(and(
              eq(ratings.guestId, guestId),
              eq(options.topicId, option.topicId)
            ))
            .limit(1);

          if (!existingForTopic) {
            // New topic — check how many distinct topics this guest has already rated
            const [countResult] = await tx
              .select({
                distinctTopics: sql<number>`COUNT(DISTINCT ${options.topicId})::int`,
              })
              .from(ratings)
              .innerJoin(options, eq(ratings.optionId, options.id))
              .where(eq(ratings.guestId, guestId));

            if ((countResult?.distinctTopics ?? 0) >= GUEST_TOPIC_LIMIT) {
              throw new TRPCError({
                code: "FORBIDDEN",
                message: "Guests can rate up to 3 topics. Sign in to rate more!",
              });
            }
          }
        }

        // Upsert rating: INSERT ON CONFLICT UPDATE for same user+option or guest+option
        let ratingId: string;

        if (userId) {
          // Upsert for authenticated user
          const [upserted] = await tx
            .insert(ratings)
            .values({
              optionId,
              userId,
              score,
              comment,
              tags: tags ?? null,
            })
            .onConflictDoUpdate({
              target: [ratings.userId, ratings.optionId],
              set: {
                score,
                comment,
                tags: tags ?? null,
                isEdited: true,
                updatedAt: new Date(),
              },
            })
            .returning({ id: ratings.id });
          ratingId = upserted.id;

          // Sync user ratingCount from source-of-truth (self-healing, handles insert + re-rate)
          const [userStats] = await tx
            .select({
              count: sql<number>`COUNT(*)::int`,
            })
            .from(ratings)
            .where(eq(ratings.userId, userId!));

          await tx
            .update(users)
            .set({ ratingCount: userStats.count })
            .where(eq(users.id, userId!));
        } else {
          // Upsert for guest
          const [upserted] = await tx
            .insert(ratings)
            .values({
              optionId,
              guestId,
              score,
              comment,
              tags: tags ?? null,
            })
            .onConflictDoUpdate({
              target: [ratings.guestId, ratings.optionId],
              set: {
                score,
                comment,
                tags: tags ?? null,
                isEdited: true,
                updatedAt: new Date(),
              },
            })
            .returning({ id: ratings.id });
          ratingId = upserted.id;
        }

        // Synchronous recalculation: recompute option-level stats from ratings table
        const [stats] = await tx
          .select({
            newAvg: sql<number>`COALESCE(AVG(${ratings.score})::real, 0)`,
            newCount: sql<number>`COUNT(*)::int`,
          })
          .from(ratings)
          .where(eq(ratings.optionId, optionId));

        // Update the option with fresh aggregated values
        await tx
          .update(options)
          .set({
            avgRating: stats.newAvg,
            ratingCount: stats.newCount,
          })
          .where(eq(options.id, optionId));

        // Recalculate topic-level totalRatings (sum of all options' ratingCounts for this topic)
        // READ COMMITTED txn: reads-own-writes is correct per-txn; concurrent commits may leave topic sum marginally stale — acceptable.
        const [topicStats] = await tx
          .select({
            totalRatings: sql<number>`COALESCE(SUM(${options.ratingCount})::int, 0)`,
          })
          .from(options)
          .where(eq(options.topicId, option.topicId));

        await tx
          .update(topics)
          .set({
            totalRatings: topicStats.totalRatings,
            lastActivity: sql`NOW()`,
            // Trending formula (docs/DESIGN.md §7): score = total_ratings / (hours_since_last_activity + 2)^1.5
            // On write, hours_since_last_activity resets to 0 since lastActivity = NOW()
            trendingScore: sql`${topicStats.totalRatings}::real / POWER(2, 1.5)`,
          })
          .where(eq(topics.id, option.topicId));

        return {
          id: ratingId,
          optionAvgRating: stats.newAvg,
          optionRatingCount: stats.newCount,
        };
      });

      return result;
    }),

  /** Get all ratings for a specific option with user info and sorting */
  getForOption: publicProcedure
    .input(z.object({
      optionId: z.string().uuid(),
      sort: z.enum(['hot', 'newest', 'controversial']).default('newest'),
      limit: z.number().int().min(1).max(100).default(20),
      cursor: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { optionId, sort, limit, cursor } = input;

      const conditions = [eq(ratings.optionId, optionId)];

      // Decode cursor for keyset pagination
      if (cursor) {
        const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString());
        if (sort === 'newest') {
          conditions.push(
            sql`(${ratings.createdAt}, ${ratings.id}) < (${decoded.sortValue}::timestamptz, ${decoded.id})`
          );
        } else if (sort === 'hot') {
          // Hot sort uses score DESC then createdAt DESC
          conditions.push(
            sql`(${ratings.score}, ${ratings.createdAt}, ${ratings.id}) < (${decoded.sortValue}, ${decoded.sortValue2}::timestamptz, ${decoded.id})`
          );
        } else {
          // Controversial uses createdAt for cursor (ordering is computed)
          conditions.push(
            sql`(${ratings.createdAt}, ${ratings.id}) < (${decoded.sortValue}::timestamptz, ${decoded.id})`
          );
        }
      }

      // Build ORDER BY clause based on sort type
      let orderByClause;
      if (sort === 'newest') {
        orderByClause = [desc(ratings.createdAt), desc(ratings.id)];
      } else if (sort === 'hot') {
        orderByClause = [desc(ratings.score), desc(ratings.createdAt), desc(ratings.id)];
      } else {
        // Controversial: ratings furthest from average score for this option
        const [avgResult] = await db
          .select({ avg: sql<number>`COALESCE(AVG(${ratings.score})::real, 5)` })
          .from(ratings)
          .where(eq(ratings.optionId, optionId));
        const avg = avgResult?.avg ?? 5;
        orderByClause = [sql`ABS(${ratings.score} - ${avg}) DESC`, desc(ratings.id)];
      }

      const results = await db
        .select({
          id: ratings.id,
          score: ratings.score,
          comment: ratings.comment,
          tags: ratings.tags,
          isEdited: ratings.isEdited,
          createdAt: ratings.createdAt,
          userId: users.id,
          username: users.username,
          avatarUrl: users.avatarUrl,
          isVerified: users.isVerified,
        })
        .from(ratings)
        .leftJoin(users, eq(ratings.userId, users.id))
        .where(and(...conditions))
        .orderBy(...orderByClause)
        .limit(limit + 1);

      // Build nextCursor
      let nextCursor: string | null = null;
      if (results.length > limit) {
        const lastItem = results[limit - 1];
        if (sort === 'hot') {
          nextCursor = Buffer.from(
            JSON.stringify({ id: lastItem.id, sortValue: lastItem.score, sortValue2: lastItem.createdAt })
          ).toString('base64');
        } else {
          nextCursor = Buffer.from(
            JSON.stringify({ id: lastItem.id, sortValue: lastItem.createdAt })
          ).toString('base64');
        }
        results.pop();
      }

      return {
        ratings: results.map((r) => ({
          id: r.id,
          score: r.score,
          comment: r.comment,
          tags: r.tags,
          isEdited: r.isEdited,
          createdAt: r.createdAt,
          user: r.userId ? {
            id: r.userId,
            username: r.username,
            avatarUrl: r.avatarUrl,
            isVerified: r.isVerified,
          } : null,
        })),
        nextCursor,
      };
    }),

  /** Get the current (logged-in) user's rating for a specific option */
  getMyRating: protectedProcedure
    .input(z.object({
      optionId: z.string().uuid(),
    }))
    .query(async ({ ctx, input }) => {
      const [rating] = await db
        .select({ score: ratings.score })
        .from(ratings)
        .where(and(
          eq(ratings.userId, ctx.auth.dbUserId),
          eq(ratings.optionId, input.optionId)
        ))
        .limit(1);

      return { score: rating?.score ?? null };
    }),

  /** Get a guest's rating for a specific option by fingerprint */
  getForGuest: publicProcedure
    .input(z.object({
      optionId: z.string().uuid(),
      fingerprint: z.string().max(64),
    }))
    .query(async ({ input }) => {
      const { optionId, fingerprint } = input;

      const [guest] = await db
        .select({ id: guests.id })
        .from(guests)
        .where(eq(guests.fingerprintHash, fingerprint))
        .limit(1);

      if (!guest) return { score: null };

      const [rating] = await db
        .select({ score: ratings.score })
        .from(ratings)
        .where(and(
          eq(ratings.guestId, guest.id),
          eq(ratings.optionId, optionId)
        ))
        .limit(1);

      return { score: rating?.score ?? null };
    }),
});
