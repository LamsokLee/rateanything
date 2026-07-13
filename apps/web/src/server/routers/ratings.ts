/**
 * Ratings router — submit and retrieve ratings for options.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { rateLimit } from "../rate-limit";
import {
  db, ratings, options, users, guests,
  eq, and, sql, desc,
} from "@rateanything/db";

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
        throw new TRPCError({ code: "NOT_FOUND", message: "Option not found" });
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
          throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
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
          code: "BAD_REQUEST",
          message: "Authentication or guest fingerprint required",
        });
      }

      // Perform upsert + O(1) incremental score update in a single transaction.
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

        // Determine if this is a NEW rating or a RE-RATE by checking for existing row
        let oldScore: number | null = null;
        if (userId) {
          const [existing] = await tx
            .select({ score: ratings.score })
            .from(ratings)
            .where(and(eq(ratings.userId, userId), eq(ratings.optionId, optionId)))
            .limit(1);
          oldScore = existing?.score ?? null;
        } else {
          const [existing] = await tx
            .select({ score: ratings.score })
            .from(ratings)
            .where(and(eq(ratings.guestId, guestId!), eq(ratings.optionId, optionId)))
            .limit(1);
          oldScore = existing?.score ?? null;
        }

        const isNew = oldScore === null;
        const delta = isNew ? score : (score - oldScore);
        const incCount = isNew ? 1 : 0;

        // Upsert the rating row
        let ratingId: string;
        if (userId) {
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
        } else {
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

        // Atomic O(1) option counter update — uses column self-references for concurrency safety
        const [updatedOption] = await tx
          .execute(sql`
            UPDATE options
            SET rating_count = rating_count + ${incCount},
                rating_sum = rating_sum + ${delta},
                avg_rating = (rating_sum + ${delta})::real / NULLIF(rating_count + ${incCount}, 0)
            WHERE id = ${optionId}
            RETURNING avg_rating, rating_count
          `);

        // Atomic O(1) topic counter update — increment totalRatings, refresh trending
        await tx
          .execute(sql`
            UPDATE topics
            SET total_ratings = total_ratings + ${incCount},
                last_activity = NOW(),
                trending_score = (total_ratings + ${incCount})::real / POWER(2, 1.5)
            WHERE id = ${option.topicId}
          `);

        // Atomic O(1) user ratingCount update (authenticated only, new ratings only)
        if (userId && isNew) {
          await tx
            .execute(sql`
              UPDATE users
              SET rating_count = rating_count + 1
              WHERE id = ${userId}
            `);
        }

        return {
          id: ratingId,
          optionAvgRating: Number(updatedOption.avg_rating),
          optionRatingCount: Number(updatedOption.rating_count),
        };
      });

      return result;
    }),

  /** Remove (cancel) a rating — inverse of submit with atomic counter decrements */
  remove: publicProcedure
    .use(rateLimit("ratings.remove", 30, 3600))
    .input(z.object({
      optionId: z.string().uuid(),
      guestFingerprint: z.string().max(64).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { optionId, guestFingerprint } = input;

      // Verify the option exists
      const [option] = await db
        .select({ id: options.id, topicId: options.topicId, avgRating: options.avgRating, ratingCount: options.ratingCount })
        .from(options)
        .where(eq(options.id, optionId))
        .limit(1);

      if (!option) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Option not found" });
      }

      // Determine if removing as authenticated user or guest
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
          throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
        }
        userId = user.id;
      } else if (guestFingerprint) {
        // Guest user - find guest record (do NOT create one on remove)
        const [existingGuest] = await db
          .select({ id: guests.id })
          .from(guests)
          .where(eq(guests.fingerprintHash, guestFingerprint))
          .limit(1);

        if (existingGuest) {
          guestId = existingGuest.id;
        } else {
          // No guest record exists — nothing to remove (idempotent)
          return {
            optionAvgRating: Number(option.avgRating ?? 0),
            optionRatingCount: Number(option.ratingCount),
          };
        }
      } else {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Authentication or guest fingerprint required",
        });
      }

      // Perform delete + inverse O(1) decremental counter update in a single transaction
      const result = await db.transaction(async (tx) => {
        // Find the existing rating row for this caller + option
        let existingRating: { id: string; score: number } | undefined;
        if (userId) {
          const [found] = await tx
            .select({ id: ratings.id, score: ratings.score })
            .from(ratings)
            .where(and(eq(ratings.userId, userId), eq(ratings.optionId, optionId)))
            .limit(1);
          existingRating = found;
        } else {
          const [found] = await tx
            .select({ id: ratings.id, score: ratings.score })
            .from(ratings)
            .where(and(eq(ratings.guestId, guestId!), eq(ratings.optionId, optionId)))
            .limit(1);
          existingRating = found;
        }

        // IDEMPOTENT: if no existing rating, just return current option stats (double-cancel safe)
        if (!existingRating) {
          const [currentOption] = await tx
            .select({ avgRating: options.avgRating, ratingCount: options.ratingCount })
            .from(options)
            .where(eq(options.id, optionId))
            .limit(1);
          return {
            optionAvgRating: Number(currentOption?.avgRating ?? 0),
            optionRatingCount: Number(currentOption?.ratingCount ?? 0),
          };
        }

        const oldScore = existingRating.score;

        // Delete the rating row
        await tx
          .execute(sql`DELETE FROM ratings WHERE id = ${existingRating.id}`);

        // Inverse atomic O(1) option counter update — uses column self-references for concurrency safety.
        // GREATEST guards on rating_sum and denominator mirror rating_count guard: prevents
        // negative sum or divide-by-negative avg if counters ever drift out of sync.
        // COALESCE(..., 0) guard: when the last rating is removed, count-1=0 so NULLIF yields NULL;
        // since avg_rating is NOT NULL, we must coalesce to 0 (UI shows "—" when count=0).
        const [updatedOption] = await tx
          .execute(sql`
            UPDATE options
            SET rating_count = GREATEST(rating_count - 1, 0),
                rating_sum = GREATEST(rating_sum - ${oldScore}, 0),
                avg_rating = COALESCE((rating_sum - ${oldScore})::real / NULLIF(GREATEST(rating_count - 1, 0), 0), 0)
            WHERE id = ${optionId}
            RETURNING avg_rating, rating_count
          `);

        // Inverse atomic O(1) topic counter update — decrement totalRatings, refresh trending
        await tx
          .execute(sql`
            UPDATE topics
            SET total_ratings = GREATEST(total_ratings - 1, 0),
                last_activity = NOW(),
                trending_score = GREATEST(total_ratings - 1, 0)::real / POWER(2, 1.5)
            WHERE id = ${option.topicId}
          `);

        // Inverse atomic O(1) user ratingCount update (authenticated only)
        if (userId) {
          await tx
            .execute(sql`
              UPDATE users
              SET rating_count = GREATEST(rating_count - 1, 0)
              WHERE id = ${userId}
            `);
        }

        return {
          optionAvgRating: Number(updatedOption.avg_rating ?? 0),
          optionRatingCount: Number(updatedOption.rating_count),
        };
      });

      return result;
    }),

  /** Get all ratings for a specific option with user info and sorting */
  getForOption: publicProcedure
    .input(z.object({
      optionId: z.string().uuid(),
      sort: z.enum(["hot", "newest", "controversial"]).default("newest"),
      limit: z.number().int().min(1).max(100).default(20),
      cursor: z.string().optional(),
    }))
    .query(async ({ ctx: _ctx, input }) => {
      const { optionId, sort, limit, cursor } = input;

      const conditions = [eq(ratings.optionId, optionId)];

      // Decode cursor for keyset pagination
      if (cursor) {
        const decoded = JSON.parse(Buffer.from(cursor, "base64").toString());
        if (sort === "newest") {
          conditions.push(
            sql`(${ratings.createdAt}, ${ratings.id}) < (${decoded.sortValue}::timestamptz, ${decoded.id})`
          );
        } else if (sort === "hot") {
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
      if (sort === "newest") {
        orderByClause = [desc(ratings.createdAt), desc(ratings.id)];
      } else if (sort === "hot") {
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
        if (sort === "hot") {
          nextCursor = Buffer.from(
            JSON.stringify({ id: lastItem.id, sortValue: lastItem.score, sortValue2: lastItem.createdAt })
          ).toString("base64");
        } else {
          nextCursor = Buffer.from(
            JSON.stringify({ id: lastItem.id, sortValue: lastItem.createdAt })
          ).toString("base64");
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
