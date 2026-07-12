/**
 * Users router — profile management, social features, and rating history.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import {
  db, users, follows, badges, userBadges, ratings, comments, options, topics,
  eq, and, sql, desc,
} from "@rateanything/db";

export const usersRouter = router({
  /** Get current authenticated user profile from DB */
  me: protectedProcedure
    .query(async ({ ctx }) => {
      const [user] = await db
        .select({
          id: users.id,
          username: users.username,
          avatarUrl: users.avatarUrl,
          bio: users.bio,
        })
        .from(users)
        .where(eq(users.clerkId, ctx.auth.userId))
        .limit(1);

      return user ?? null;
    }),

  /** Get a user's public profile by username with badge list */
  getProfile: publicProcedure
    .input(z.object({ username: z.string() }))
    .query(async ({ ctx, input }) => {
      const [user] = await db
        .select({
          id: users.id,
          username: users.username,
          avatarUrl: users.avatarUrl,
          bio: users.bio,
          location: users.location,
          isVerified: users.isVerified,
          reputation: users.reputation,
          ratingCount: users.ratingCount,
          followerCount: users.followerCount,
          followingCount: users.followingCount,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.username, input.username))
        .limit(1);

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      const userBadgeList = await db
        .select({
          id: badges.id,
          name: badges.name,
          description: badges.description,
          icon: badges.icon,
          awardedAt: userBadges.awardedAt,
        })
        .from(userBadges)
        .innerJoin(badges, eq(userBadges.badgeId, badges.id))
        .where(eq(userBadges.userId, user.id));

      return {
        ...user,
        badges: userBadgeList,
      };
    }),

  /** Get a user's rating history with pagination */
  getRatingHistory: publicProcedure
    .input(z.object({
      username: z.string(),
      cursor: z.string().optional(),
      limit: z.number().int().min(1).max(50).default(20),
    }))
    .query(async ({ input }) => {
      const { username, cursor, limit } = input;

      // Find user by username
      const [user] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, username))
        .limit(1);

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      const conditions = [eq(ratings.userId, user.id)];

      if (cursor) {
        let decoded: { id: string; createdAt: string };
        try {
          decoded = JSON.parse(Buffer.from(cursor, "base64").toString());
        } catch {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid cursor" });
        }
        conditions.push(
          sql`(${ratings.createdAt}, ${ratings.id}) < (${decoded.createdAt}::timestamptz, ${decoded.id})`
        );
      }

      const results = await db
        .select({
          id: ratings.id,
          score: ratings.score,
          createdAt: ratings.createdAt,
          optionName: options.name,
          topicId: topics.id,
          topicTitle: topics.title,
          topicSlug: topics.slug,
        })
        .from(ratings)
        .innerJoin(options, eq(ratings.optionId, options.id))
        .innerJoin(topics, eq(options.topicId, topics.id))
        .where(and(...conditions))
        .orderBy(desc(ratings.createdAt), desc(ratings.id))
        .limit(limit + 1);

      let nextCursor: string | null = null;
      if (results.length > limit) {
        const lastItem = results[limit - 1];
        nextCursor = Buffer.from(
          JSON.stringify({ id: lastItem.id, createdAt: lastItem.createdAt })
        ).toString("base64");
        results.pop();
      }

      return {
        items: results.map((r) => ({
          topicTitle: r.topicTitle,
          topicSlug: r.topicSlug,
          optionName: r.optionName,
          score: r.score,
          createdAt: r.createdAt,
        })),
        nextCursor,
      };
    }),

  /** Get a user's comment history with pagination */
  getCommentHistory: publicProcedure
    .input(z.object({
      username: z.string(),
      cursor: z.string().optional(),
      limit: z.number().int().min(1).max(50).default(20),
    }))
    .query(async ({ input }) => {
      const { username, cursor, limit } = input;

      // Find user by username
      const [user] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, username))
        .limit(1);

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      const conditions = [eq(comments.userId, user.id)];

      if (cursor) {
        let decoded: { id: string; createdAt: string };
        try {
          decoded = JSON.parse(Buffer.from(cursor, "base64").toString());
        } catch {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid cursor" });
        }
        conditions.push(
          sql`(${comments.createdAt}, ${comments.id}) < (${decoded.createdAt}::timestamptz, ${decoded.id})`
        );
      }

      // Resolve topic: directly via topicId, or via ratingId -> options -> topics
      // Use sql subqueries for the rating path to avoid aliased table type issues
      const results = await db
        .select({
          id: comments.id,
          content: comments.content,
          score: comments.score,
          createdAt: comments.createdAt,
          directTopicTitle: topics.title,
          directTopicSlug: topics.slug,
          ratingTopicTitle: sql<string | null>`(
            SELECT t.title FROM topics t
            INNER JOIN options o ON o.topic_id = t.id
            INNER JOIN ratings r ON r.option_id = o.id
            WHERE r.id = ${comments.ratingId}
            LIMIT 1
          )`.as("rating_topic_title"),
          ratingTopicSlug: sql<string | null>`(
            SELECT t.slug FROM topics t
            INNER JOIN options o ON o.topic_id = t.id
            INNER JOIN ratings r ON r.option_id = o.id
            WHERE r.id = ${comments.ratingId}
            LIMIT 1
          )`.as("rating_topic_slug"),
        })
        .from(comments)
        .leftJoin(topics, eq(comments.topicId, topics.id))
        .where(and(...conditions))
        .orderBy(desc(comments.createdAt), desc(comments.id))
        .limit(limit + 1);

      let nextCursor: string | null = null;
      if (results.length > limit) {
        const lastItem = results[limit - 1];
        nextCursor = Buffer.from(
          JSON.stringify({ id: lastItem.id, createdAt: lastItem.createdAt })
        ).toString("base64");
        results.pop();
      }

      return {
        items: results.map((r) => ({
          id: r.id,
          content: r.content,
          score: r.score,
          createdAt: r.createdAt,
          topicTitle: r.directTopicTitle ?? r.ratingTopicTitle ?? "Unknown Topic",
          topicSlug: r.directTopicSlug ?? r.ratingTopicSlug ?? "",
        })),
        nextCursor,
      };
    }),

  /** Follow another user */
  follow: protectedProcedure
    .input(z.object({ targetUserId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [follower] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.clerkId, ctx.auth.userId))
        .limit(1);

      if (!follower) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      if (follower.id === input.targetUserId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot follow yourself" });
      }

      const [target] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, input.targetUserId))
        .limit(1);

      if (!target) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Target user not found" });
      }

      await db.transaction(async (tx) => {
        await tx
          .insert(follows)
          .values({
            followerId: follower.id,
            followingId: input.targetUserId,
          });

        await tx
          .update(users)
          .set({ followingCount: sql`${users.followingCount} + 1` })
          .where(eq(users.id, follower.id));

        await tx
          .update(users)
          .set({ followerCount: sql`${users.followerCount} + 1` })
          .where(eq(users.id, input.targetUserId));
      });

      return { success: true };
    }),

  /** Unfollow a user */
  unfollow: protectedProcedure
    .input(z.object({ targetUserId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [follower] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.clerkId, ctx.auth.userId))
        .limit(1);

      if (!follower) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      await db.transaction(async (tx) => {
        const deleted = await tx
          .delete(follows)
          .where(
            and(
              eq(follows.followerId, follower.id),
              eq(follows.followingId, input.targetUserId)
            )
          )
          .returning({ followerId: follows.followerId });

        if (deleted.length > 0) {
          await tx
            .update(users)
            .set({ followingCount: sql`GREATEST(${users.followingCount} - 1, 0)` })
            .where(eq(users.id, follower.id));

          await tx
            .update(users)
            .set({ followerCount: sql`GREATEST(${users.followerCount} - 1, 0)` })
            .where(eq(users.id, input.targetUserId));
        }
      });

      return { success: true };
    }),

  /** Delete own account (GDPR compliance) — anonymize data, keep structure */
  deleteAccount: protectedProcedure
    .mutation(async ({ ctx }) => {
      const [user] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.clerkId, ctx.auth.userId))
        .limit(1);

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      await db.transaction(async (tx) => {
        await tx
          .update(ratings)
          .set({ userId: null })
          .where(eq(ratings.userId, user.id));

        await tx
          .update(comments)
          .set({
            content: "[deleted]",
            userId: null,
          })
          .where(eq(comments.userId, user.id));

        await tx
          .delete(follows)
          .where(eq(follows.followerId, user.id));
        await tx
          .delete(follows)
          .where(eq(follows.followingId, user.id));

        await tx
          .delete(userBadges)
          .where(eq(userBadges.userId, user.id));

        await tx
          .delete(users)
          .where(eq(users.id, user.id));
      });

      return { success: true };
    }),
});
