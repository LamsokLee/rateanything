/**
 * Topics router — CRUD and discovery for rating topics.
 */
import { z } from "zod";
import { topicCreateInputSchema } from "../schemas";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { rateLimit } from "../rate-limit";
import {
  db, topics, options, categories, users, ratings,
  eq, and, sql, desc, asc, inArray,
} from "@rateanything/db";
import { slugify } from "@/lib/slugify";

export const topicsRouter = router({
  /** Create a new topic (requires auth) */
  create: protectedProcedure
    .use(rateLimit("topics.create", 10, 3600))
    .input(topicCreateInputSchema)
    .mutation(async ({ ctx, input }) => {
      const [user] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.clerkId, ctx.auth.userId))
        .limit(1);

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      const baseSlug = slugify(input.title);
      const uniqueSuffix = Math.random().toString(36).slice(2, 8);
      const slug = `${baseSlug}-${uniqueSuffix}`;

      const result = await db.transaction(async (tx) => {
        const [topic] = await tx
          .insert(topics)
          .values({
            title: input.title,
            slug,
            description: input.description,
            categoryId: input.categoryId,
            imageUrl: input.imageUrl,
            sourceUrl: input.sourceUrl,
            creatorId: user.id,
          })
          .returning({ id: topics.id, slug: topics.slug });

        await tx.insert(options).values(
          input.options.map((opt, index) => ({
            topicId: topic.id,
            name: opt.name,
            description: opt.description,
            imageUrl: opt.imageUrl,
            sortOrder: index,
          }))
        );

        return topic;
      });

      return { id: result.id, slug: result.slug };
    }),

  /** Get a single topic by its URL slug */
  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const [topic] = await db
        .select({
          id: topics.id,
          title: topics.title,
          slug: topics.slug,
          description: topics.description,
          imageUrl: topics.imageUrl,
          sourceUrl: topics.sourceUrl,
          status: topics.status,
          allowNewOptions: topics.allowNewOptions,
          totalRatings: topics.totalRatings,
          trendingScore: topics.trendingScore,
          createdAt: topics.createdAt,
          lastActivity: topics.lastActivity,
          categoryId: categories.id,
          categoryName: categories.name,
          categorySlug: categories.slug,
          creatorId: users.id,
          creatorUsername: users.username,
          creatorAvatarUrl: users.avatarUrl,
        })
        .from(topics)
        .leftJoin(categories, eq(topics.categoryId, categories.id))
        .leftJoin(users, eq(topics.creatorId, users.id))
        .where(eq(topics.slug, input.slug))
        .limit(1);

      if (!topic) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Topic not found" });
      }

      const topicOptions = await db
        .select()
        .from(options)
        .where(eq(options.topicId, topic.id))
        .orderBy(asc(options.sortOrder));

      let userRatings: Record<string, number> = {};
      if (ctx.auth?.userId) {
        const [authUser] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.clerkId, ctx.auth.userId))
          .limit(1);

        if (authUser) {
          const optionIds = topicOptions.map((o) => o.id);
          if (optionIds.length > 0) {
            const myRatings = await db
              .select({ optionId: ratings.optionId, score: ratings.score })
              .from(ratings)
              .where(
                and(
                  eq(ratings.userId, authUser.id),
                  inArray(ratings.optionId, optionIds)
                )
              );

            for (const r of myRatings) {
              userRatings[r.optionId] = r.score;
            }
          }
        }
      }

      // Fetch score distribution for each option (count per score 1-10)
      const optionIds = topicOptions.map((o) => o.id);
      const distributionMap: Record<string, Record<number, number>> = {};
      if (optionIds.length > 0) {
        // Safe: optionIds are UUIDs fetched from our own DB in this request, not user input
        const distRows = await db
          .select({
            optionId: ratings.optionId,
            score: ratings.score,
            cnt: sql<number>`count(*)::int`,
          })
          .from(ratings)
          .where(inArray(ratings.optionId, optionIds))
          .groupBy(ratings.optionId, ratings.score);
        for (const row of distRows) {
          if (!distributionMap[row.optionId]) {
            distributionMap[row.optionId] = {};
          }
          distributionMap[row.optionId][Number(row.score)] = Number(row.cnt);
        }
      }

      // Fetch top comment per option (most recent rating with a comment)
      const topComments: Record<string, { comment: string; username: string; score: number; upvotes: number }> = {};
      if (optionIds.length > 0) {
        const commentRows = await db
          .select({
            optionId: ratings.optionId,
            comment: ratings.comment,
            score: ratings.score,
            createdAt: ratings.createdAt,
            username: users.username,
          })
          .from(ratings)
          .leftJoin(users, eq(ratings.userId, users.id))
          .where(
            and(
              inArray(ratings.optionId, optionIds),
              sql`${ratings.comment} IS NOT NULL`,
              sql`${ratings.comment} != ''`
            )
          )
          .orderBy(desc(ratings.optionId), desc(ratings.createdAt));

        // Deduplicate to get the most recent comment per option
        const seen = new Set<string>();
        for (const row of commentRows) {
          if (!seen.has(row.optionId)) {
            seen.add(row.optionId);
            topComments[row.optionId] = {
              comment: row.comment!,
              username: row.username ?? "Anonymous",
              score: row.score,
              upvotes: 0,
            };
          }
        }
      }

      return {
        id: topic.id,
        title: topic.title,
        slug: topic.slug,
        description: topic.description,
        imageUrl: topic.imageUrl,
        sourceUrl: topic.sourceUrl,
        status: topic.status,
        allowNewOptions: topic.allowNewOptions,
        totalRatings: topic.totalRatings,
        trendingScore: topic.trendingScore,
        createdAt: topic.createdAt,
        lastActivity: topic.lastActivity,
        category: topic.categoryId ? {
          id: topic.categoryId,
          name: topic.categoryName,
          slug: topic.categorySlug,
        } : null,
        creator: topic.creatorId ? {
          id: topic.creatorId,
          username: topic.creatorUsername,
          avatarUrl: topic.creatorAvatarUrl,
        } : null,
        options: topicOptions.map((opt) => ({
          ...opt,
          userRating: userRatings[opt.id] ?? null,
          distribution: distributionMap[opt.id] ?? {},
          topComment: topComments[opt.id] ?? null,
        })),
      };
    }),

  /** Get trending topics with optional category filter */
  trending: publicProcedure
    .input(z.object({
      categoryId: z.number().int().positive().optional(),
      limit: z.number().int().min(1).max(50).default(20),
      cursor: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { limit, cursor, categoryId } = input;

      const conditions = [eq(topics.status, "active")];

      if (categoryId) {
        conditions.push(eq(topics.categoryId, categoryId));
      }

      // Trending formula: total_ratings / (hours_since_last_activity + 2)^1.5 — extracted once to avoid drift
      const trendingExpr = sql`total_ratings::real / POWER(EXTRACT(EPOCH FROM (NOW() - last_activity)) / 3600.0 + 2, 1.5)`;

      if (cursor) {
        const decoded = JSON.parse(Buffer.from(cursor, "base64").toString());
        // Cursor uses effective trending score with read-time decay
        conditions.push(
          sql`(${trendingExpr}, ${topics.id}) < (${decoded.sortValue}, ${decoded.id})`
        );
      }

      const results = await db
        .select({
          id: topics.id,
          title: topics.title,
          slug: topics.slug,
          description: topics.description,
          imageUrl: topics.imageUrl,
          totalRatings: topics.totalRatings,
          trendingScore: topics.trendingScore,
          createdAt: topics.createdAt,
          categoryName: categories.name,
          categorySlug: categories.slug,
          creatorUsername: users.username,
          creatorAvatarUrl: users.avatarUrl,
          // Trending formula (DESIGN.md S7): effective_score = total_ratings / (hours_since_last_activity + 2)^1.5
          // Computed at read-time so decay is always fresh without cron
          effectiveTrendingScore: sql<number>`${trendingExpr}`,
        })
        .from(topics)
        .leftJoin(categories, eq(topics.categoryId, categories.id))
        .leftJoin(users, eq(topics.creatorId, users.id))
        .where(and(...conditions))
        .orderBy(sql`${trendingExpr} DESC`, desc(topics.id))
        .limit(limit + 1);

      let nextCursor: string | null = null;
      if (results.length > limit) {
        const lastItem = results[limit - 1];
        // Use effective (read-time decayed) score for cursor pagination
        nextCursor = Buffer.from(
          JSON.stringify({ id: lastItem.id, sortValue: lastItem.effectiveTrendingScore })
        ).toString("base64");
        results.pop();
      }

      // Fetch top 3 options and option counts for each topic
      const topicIds = results.map((t) => t.id);
      const topicOptionsMap: Record<string, { name: string; avgRating: number }[]> = {};
      const optionCountMap: Record<string, number> = {};
      if (topicIds.length > 0) {
        const topicOpts = await db
          .select({
            topicId: options.topicId,
            name: options.name,
            avgRating: options.avgRating,
          })
          .from(options)
          .where(inArray(options.topicId, topicIds))
          .orderBy(desc(options.avgRating));

        for (const opt of topicOpts) {
          if (!topicOptionsMap[opt.topicId]) {
            topicOptionsMap[opt.topicId] = [];
          }
          topicOptionsMap[opt.topicId].push({ name: opt.name, avgRating: opt.avgRating });
          optionCountMap[opt.topicId] = (optionCountMap[opt.topicId] ?? 0) + 1;
        }
      }

      return {
        topics: results.map((t) => ({
          ...t,
          topOptions: (topicOptionsMap[t.id] ?? []).slice(0, 3),
          optionCount: optionCountMap[t.id] ?? 0,
        })),
        nextCursor,
      };
    }),

  /** Full-text search topics by title */
  search: publicProcedure
    .input(z.object({
      query: z.string().min(2).max(100),
      limit: z.number().int().min(1).max(50).default(20),
      cursor: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { query, limit, cursor } = input;

      const searchPattern = `%${query}%`;
      const conditions = [
        eq(topics.status, "active"),
        sql`${topics.title} ILIKE ${searchPattern}`,
      ];

      if (cursor) {
        const decoded = JSON.parse(Buffer.from(cursor, "base64").toString());
        conditions.push(
          sql`(${topics.createdAt}, ${topics.id}) < (${decoded.sortValue}::timestamptz, ${decoded.id})`
        );
      }

      const results = await db
        .select({
          id: topics.id,
          title: topics.title,
          slug: topics.slug,
          description: topics.description,
          imageUrl: topics.imageUrl,
          totalRatings: topics.totalRatings,
          trendingScore: topics.trendingScore,
          createdAt: topics.createdAt,
          categoryName: categories.name,
          categorySlug: categories.slug,
        })
        .from(topics)
        .leftJoin(categories, eq(topics.categoryId, categories.id))
        .where(and(...conditions))
        .orderBy(desc(topics.createdAt), desc(topics.id))
        .limit(limit + 1);

      let nextCursor: string | null = null;
      if (results.length > limit) {
        const lastItem = results[limit - 1];
        nextCursor = Buffer.from(
          JSON.stringify({ id: lastItem.id, sortValue: lastItem.createdAt })
        ).toString("base64");
        results.pop();
      }

      return { topics: results, nextCursor };
    }),

  /** Get topics by category slug */
  byCategory: publicProcedure
    .input(z.object({
      slug: z.string(),
      limit: z.number().int().min(1).max(50).default(20),
      cursor: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { slug, limit, cursor } = input;

      const [category] = await db
        .select({ id: categories.id, name: categories.name, slug: categories.slug })
        .from(categories)
        .where(eq(categories.slug, slug))
        .limit(1);

      if (!category) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Category not found" });
      }

      const conditions = [
        eq(topics.status, "active"),
        eq(topics.categoryId, category.id),
      ];

      if (cursor) {
        const decoded = JSON.parse(Buffer.from(cursor, "base64").toString());
        conditions.push(
          sql`(${topics.createdAt}, ${topics.id}) < (${decoded.sortValue}::timestamptz, ${decoded.id})`
        );
      }

      const results = await db
        .select({
          id: topics.id,
          title: topics.title,
          slug: topics.slug,
          description: topics.description,
          imageUrl: topics.imageUrl,
          totalRatings: topics.totalRatings,
          trendingScore: topics.trendingScore,
          createdAt: topics.createdAt,
          categoryName: categories.name,
          categorySlug: categories.slug,
          creatorUsername: users.username,
          creatorAvatarUrl: users.avatarUrl,
        })
        .from(topics)
        .leftJoin(categories, eq(topics.categoryId, categories.id))
        .leftJoin(users, eq(topics.creatorId, users.id))
        .where(and(...conditions))
        .orderBy(desc(topics.createdAt), desc(topics.id))
        .limit(limit + 1);

      let nextCursor: string | null = null;
      if (results.length > limit) {
        const lastItem = results[limit - 1];
        nextCursor = Buffer.from(
          JSON.stringify({ id: lastItem.id, sortValue: lastItem.createdAt })
        ).toString("base64");
        results.pop();
      }

      // Fetch top options for each topic
      const topicIds = results.map((t) => t.id);
      const topicOptionsMap: Record<string, { name: string; avgRating: number }[]> = {};
      const optionCountMap: Record<string, number> = {};
      if (topicIds.length > 0) {
        const topicOpts = await db
          .select({
            topicId: options.topicId,
            name: options.name,
            avgRating: options.avgRating,
          })
          .from(options)
          .where(inArray(options.topicId, topicIds))
          .orderBy(desc(options.avgRating));

        for (const opt of topicOpts) {
          if (!topicOptionsMap[opt.topicId]) {
            topicOptionsMap[opt.topicId] = [];
          }
          topicOptionsMap[opt.topicId].push({ name: opt.name, avgRating: opt.avgRating });
          optionCountMap[opt.topicId] = (optionCountMap[opt.topicId] ?? 0) + 1;
        }
      }

      return {
        category,
        topics: results.map((t) => ({
          ...t,
          topOptions: (topicOptionsMap[t.id] ?? []).slice(0, 3),
          optionCount: optionCountMap[t.id] ?? 0,
        })),
        nextCursor,
      };
    }),

  /** Add a new option to an existing topic (if allowed) */
  addOption: protectedProcedure
    .use(rateLimit("topics.addOption", 20, 3600))
    .input(z.object({
      topicId: z.string().uuid(),
      name: z.string().min(1).max(200),
      description: z.string().max(1000).optional(),
      imageUrl: z.string().url().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [topic] = await db
        .select({ id: topics.id, allowNewOptions: topics.allowNewOptions })
        .from(topics)
        .where(eq(topics.id, input.topicId))
        .limit(1);

      if (!topic) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Topic not found" });
      }

      if (!topic.allowNewOptions) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This topic does not allow adding new options",
        });
      }

      const [maxOrder] = await db
        .select({ max: sql<number>`COALESCE(MAX(${options.sortOrder}), -1)` })
        .from(options)
        .where(eq(options.topicId, input.topicId));

      const [newOption] = await db
        .insert(options)
        .values({
          topicId: input.topicId,
          name: input.name,
          description: input.description,
          imageUrl: input.imageUrl,
          sortOrder: (maxOrder?.max ?? -1) + 1,
        })
        .returning();

      return newOption;
    }),

  /** Get rating history time-series for a topic (for charting) */
  ratingHistory: publicProcedure
    .input(z.object({
      topicId: z.string().uuid(),
      bucketSize: z.enum(["hour", "day"]).default("day"),
    }))
    .query(async ({ input }) => {
      const { topicId, bucketSize } = input;

      const topicOptions = await db
        .select({ id: options.id, name: options.name })
        .from(options)
        .where(eq(options.topicId, topicId))
        .orderBy(asc(options.sortOrder));

      if (topicOptions.length === 0) {
        return { options: [] };
      }

      const optionIds = topicOptions.map((o) => o.id);

      // Safe: uses parameterized sql placeholders via Drizzle (no sql.raw interpolation)
      const bucketSizeLiteral = bucketSize === "hour" ? sql.raw("'hour'") : sql.raw("'day'");
      const historyRows = await db.execute<{
        option_id: string;
        bucket: string;
        running_avg: number;
        cumulative_count: string;
      }>(
        sql`SELECT
          option_id,
          bucket,
          AVG(daily_avg) OVER (PARTITION BY option_id ORDER BY bucket ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)::float as running_avg,
          SUM(cnt) OVER (PARTITION BY option_id ORDER BY bucket)::int as cumulative_count
        FROM (
          SELECT option_id, date_trunc(${bucketSizeLiteral}, created_at)::text as bucket, AVG(score) as daily_avg, COUNT(*) as cnt
          FROM ratings
          WHERE option_id IN (${sql.join(optionIds.map(id => sql`${id}`), sql`,`)})  
          GROUP BY option_id, date_trunc(${bucketSizeLiteral}, created_at)
        ) sub
        ORDER BY option_id, bucket ASC`
      );

      const historyByOption: Record<string, { timestamp: string; avgScore: number; count: number }[]> = {};
      for (const row of historyRows) {
        if (!historyByOption[row.option_id]) {
          historyByOption[row.option_id] = [];
        }
        historyByOption[row.option_id].push({
          timestamp: row.bucket,
          avgScore: Number(row.running_avg),
          count: Number(row.cumulative_count),
        });
      }
      return {
        options: topicOptions.map((opt) => ({
          optionId: opt.id,
          optionName: opt.name,
          history: historyByOption[opt.id] ?? [],
        })),
      };
    }),
});
