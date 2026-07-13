/**
 * Comments router — threaded discussions on topics and ratings.
 * Supports per-topic comments with upvote/downvote and nested replies.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { getCached, invalidateCache } from "../cache";
import { rateLimit } from "../rate-limit";
import {
  db, comments, users, ratings, topics, commentVotes,
  eq, and, sql, desc, asc,
} from "@rateanything/db";


export const commentsRouter = router({
  /** Get comments for a topic with nested replies (2-level) */
  getForTopic: publicProcedure
    .input(z.object({
      topicId: z.string().uuid(),
      sort: z.enum(["newest", "top"]).default("newest"),
      cursor: z.string().optional(),
      limit: z.number().int().min(1).max(50).default(20),
    }))
    .query(async ({ input, ctx }) => {
      const result = await getCached(
        "comments.getForTopic",
        input,
        30, // 30s TTL — comments change frequently
        async () => {
          const { topicId, sort, cursor, limit } = input;
          const currentUserId = ctx.auth?.dbUserId ?? null;

          let cursorCondition = sql`TRUE`;
          if (cursor) {
            const decoded = JSON.parse(Buffer.from(cursor, "base64").toString());
            if (sort === "newest") {
              cursorCondition = sql`(${comments.createdAt}, ${comments.id}) < (${decoded.sortValue}::timestamptz, ${decoded.id})`;
            } else {
              cursorCondition = sql`(${comments.upvotes} - ${comments.downvotes}, ${comments.createdAt}, ${comments.id}) < (${decoded.sortValue}, ${decoded.sortValue2}::timestamptz, ${decoded.id})`;
            }
          }

          const orderBy = sort === "newest"
            ? [desc(comments.createdAt), desc(comments.id)]
            : [sql`(${comments.upvotes} - ${comments.downvotes}) DESC`, desc(comments.createdAt), desc(comments.id)];

          const topLevelComments = await db
            .select({
              id: comments.id,
              content: comments.content,
              upvotes: comments.upvotes,
              downvotes: comments.downvotes,
              createdAt: comments.createdAt,
              isDeleted: comments.isDeleted,
              commentUserId: comments.userId,
              userId: users.id,
              username: users.username,
            })
            .from(comments)
            .leftJoin(users, eq(comments.userId, users.id))
            .where(and(eq(comments.topicId, topicId), sql`${comments.parentId} IS NULL`, cursorCondition))
            .orderBy(...orderBy)
            .limit(limit + 1);

          let nextCursor: string | null = null;
          if (topLevelComments.length > limit) {
            const lastItem = topLevelComments[limit - 1];
            if (sort === "newest") {
              nextCursor = Buffer.from(
                JSON.stringify({ id: lastItem.id, sortValue: lastItem.createdAt })
              ).toString("base64");
            } else {
              nextCursor = Buffer.from(
                JSON.stringify({
                  id: lastItem.id,
                  sortValue: (lastItem.upvotes ?? 0) - (lastItem.downvotes ?? 0),
                  sortValue2: lastItem.createdAt,
                })
              ).toString("base64");
            }
            topLevelComments.pop();
          }

          // Fetch replies for all top-level comments
          const parentIds = topLevelComments.map((c) => c.id);
          type ReplyRow = (typeof topLevelComments)[number] & { parentId: string | null };
          const repliesMap: Record<string, ReplyRow[]> = {};

          if (parentIds.length > 0) {
            const idsLiteral = sql.join(parentIds.map(id => sql`${id}`), sql`, `);
            const replies = await db
              .select({
                id: comments.id,
                parentId: comments.parentId,
                content: comments.content,
                upvotes: comments.upvotes,
                downvotes: comments.downvotes,
                createdAt: comments.createdAt,
                isDeleted: comments.isDeleted,
                commentUserId: comments.userId,
                userId: users.id,
                username: users.username,
              })
              .from(comments)
              .leftJoin(users, eq(comments.userId, users.id))
              .where(sql`${comments.parentId} IN (${idsLiteral})`)
              .orderBy(asc(comments.createdAt));

            for (const reply of replies) {
              const pid = reply.parentId ?? "";
              if (!repliesMap[pid]) {
                repliesMap[pid] = [];
              }
              repliesMap[pid].push(reply);
            }
          }

          // Fetch current user's votes for these comments (if authenticated)
          const allCommentIds = [...parentIds];
          for (const replies of Object.values(repliesMap)) {
            for (const r of replies) allCommentIds.push(r.id);
          }

          let userVotesMap: Record<string, string> = {};
          if (currentUserId && allCommentIds.length > 0) {
            const idsLiteral2 = sql.join(allCommentIds.map(id => sql`${id}`), sql`, `);
            const userVotes = await db
              .select({ commentId: commentVotes.commentId, vote: commentVotes.vote })
              .from(commentVotes)
              .where(and(
                eq(commentVotes.userId, currentUserId),
                sql`${commentVotes.commentId} IN (${idsLiteral2})`
              ));
            for (const v of userVotes) {
              userVotesMap[v.commentId] = v.vote;
            }
          }

          return {
            comments: topLevelComments.map((c) => ({
              id: c.id,
              content: c.content,
              upvotes: c.upvotes ?? 0,
              downvotes: c.downvotes ?? 0,
              createdAt: c.createdAt,
              isDeleted: c.isDeleted,
              isOwner: currentUserId != null && c.commentUserId === currentUserId,
              user: c.userId ? { id: c.userId, username: c.username } : null,
              userVote: userVotesMap[c.id] ?? null,
              replies: (repliesMap[c.id] ?? []).map((r) => ({
                id: r.id,
                content: r.content,
                upvotes: r.upvotes ?? 0,
                downvotes: r.downvotes ?? 0,
                createdAt: r.createdAt,
                isDeleted: r.isDeleted,
                isOwner: currentUserId != null && r.commentUserId === currentUserId,
                user: r.userId ? { id: r.userId, username: r.username } : null,
                userVote: userVotesMap[r.id] ?? null,
              })),
            })),
            nextCursor,
          };
        }
      );
      return result.data;
    }),

  /** Create a new comment on a topic (top-level or reply) */
  create: protectedProcedure
    .use(rateLimit("comments.create", 60, 3600))
    .input(z.object({
      topicId: z.string().uuid(),
      content: z.string().min(1).max(500),
      parentId: z.string().uuid().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [topic] = await db
        .select({ id: topics.id })
        .from(topics)
        .where(eq(topics.id, input.topicId))
        .limit(1);

      if (!topic) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Topic not found" });
      }

      if (input.parentId) {
        const [parentComment] = await db
          .select({ id: comments.id, parentId: comments.parentId })
          .from(comments)
          .where(eq(comments.id, input.parentId))
          .limit(1);

        if (!parentComment) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Parent comment not found" });
        }

        if (parentComment.parentId !== null) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Maximum nesting depth reached (2 levels)",
          });
        }
      }

      const result = await db.transaction(async (tx) => {
        const [newComment] = await tx
          .insert(comments)
          .values({
            topicId: input.topicId,
            userId: ctx.auth.dbUserId,
            parentId: input.parentId ?? null,
            content: input.content,
          })
          .returning({ id: comments.id, createdAt: comments.createdAt });

        // Recalculate trending score on comment activity (docs/DESIGN.md §7)
        // Formula: total_ratings / (hours_since_last_activity + 2)^1.5
        // Reset lastActivity to NOW() so hours_since_last_activity = 0 on this write
        await tx
          .update(topics)
          .set({
            lastActivity: sql`NOW()`,
            trendingScore: sql`total_ratings::real / POWER(2, 1.5)`,
          })
          .where(eq(topics.id, input.topicId));

        return { id: newComment.id, createdAt: newComment.createdAt };
      });

      // Invalidate comment caches for this topic
      await invalidateCache(`comments.getForTopic:*"topicId":"${input.topicId}"*`);
      // Also invalidate the topic detail page (lastActivity changed)
      await invalidateCache("topics.getBySlug:*");
      // Invalidate trending since trending score changed
      await invalidateCache("topics.trending:*");

      return result;
    }),

  /** Reply to a rating or another comment (max 2 levels of nesting) */
  reply: protectedProcedure
    .use(rateLimit("comments.reply", 60, 3600))
    .input(z.object({
      ratingId: z.string().uuid(),
      parentId: z.string().uuid().optional(),
      content: z.string().min(20).max(500),
    }))
    .mutation(async ({ ctx, input }) => {
      const [rating] = await db
        .select({ id: ratings.id })
        .from(ratings)
        .where(eq(ratings.id, input.ratingId))
        .limit(1);

      if (!rating) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Rating not found" });
      }

      if (input.parentId) {
        const [parentComment] = await db
          .select({ id: comments.id, parentId: comments.parentId })
          .from(comments)
          .where(eq(comments.id, input.parentId))
          .limit(1);

        if (!parentComment) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Parent comment not found" });
        }

        if (parentComment.parentId !== null) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Maximum nesting depth reached (2 levels)",
          });
        }
      }

      const [newComment] = await db
        .insert(comments)
        .values({
          ratingId: input.ratingId,
          userId: ctx.auth.dbUserId,
          parentId: input.parentId ?? null,
          content: input.content,
        })
        .returning({ id: comments.id, createdAt: comments.createdAt });

      return { id: newComment.id, createdAt: newComment.createdAt };
    }),

  /**
   * Delete (remove) a comment — Reddit-style:
   * - If the comment HAS replies: tombstone (soft-delete) to preserve thread structure.
   *   Sets content='[deleted]', is_deleted=true, user_id=NULL.
   * - If the comment is a LEAF (no replies): hard-delete the row (votes cascade).
   *   Then check if the parent is an orphaned tombstone and clean it up.
   *
   * CASCADE SAFETY: parentId FK has onDelete CASCADE — hard-deleting a parent
   * would destroy all children. We ONLY hard-delete leaf comments (no children).
   *
   * Topic trending score is NOT updated on delete (no comment counter exists,
   * and recalculating trending on delete would add complexity for minimal benefit).
   */
  remove: protectedProcedure
    .use(rateLimit("comments.remove", 60, 3600))
    .input(z.object({
      commentId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { commentId } = input;

      // Load the comment to verify ownership and current state
      const [comment] = await db
        .select({
          id: comments.id,
          userId: comments.userId,
          parentId: comments.parentId,
          isDeleted: comments.isDeleted,
          topicId: comments.topicId,
        })
        .from(comments)
        .where(eq(comments.id, commentId))
        .limit(1);

      if (!comment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Comment not found" });
      }

      // Authorization: only the comment author or an admin may delete
      const isAuthor = comment.userId === ctx.auth.dbUserId;
      if (!isAuthor) {
        // Check if the current user is an admin (users.isAdmin exists in schema)
        const [currentUser] = await db
          .select({ isAdmin: users.isAdmin })
          .from(users)
          .where(eq(users.id, ctx.auth.dbUserId))
          .limit(1);

        if (!currentUser?.isAdmin) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only the comment author or an admin can delete this comment",
          });
        }
      }

      // Idempotent: if already tombstoned, return early
      if (comment.isDeleted) {
        return { success: true as const, mode: "already-deleted" as const };
      }

      return await db.transaction(async (tx) => {
        // Check if this comment has any replies (children)
        const [hasRepliesResult] = await tx
          .select({ exists: sql<boolean>`EXISTS(SELECT 1 FROM comments WHERE parent_id = ${commentId})` })
          .from(sql`(SELECT 1) AS _dummy`);

        const hasReplies = hasRepliesResult.exists;

        if (hasReplies) {
          // TOMBSTONE branch: comment has children — soft-delete to preserve thread.
          // CASCADE SAFETY: hard-deleting here would destroy all child comments
          // due to parentId's onDelete CASCADE constraint.
          await tx
            .update(comments)
            .set({
              content: "[deleted]",
              isDeleted: true,
              userId: null,
              updatedAt: sql`NOW()`,
            })
            .where(eq(comments.id, commentId));

          return { success: true as const, mode: "tombstoned" as const };
        } else {
          // LEAF branch: no children — safe to hard-delete (comment_votes cascade automatically)
          await tx
            .delete(comments)
            .where(eq(comments.id, commentId));

          // Reddit-style parent cleanup: if the deleted leaf had a parent that is
          // itself tombstoned and now has zero remaining children, remove the parent too.
          // Nesting is capped at 2 levels, so this climbs at most one step, but we
          // use a loop for safety in case of future nesting depth changes.
          let parentIdToCheck = comment.parentId;
          let parentCleaned = false;

          while (parentIdToCheck) {
            const [parentComment] = await tx
              .select({
                id: comments.id,
                isDeleted: comments.isDeleted,
                parentId: comments.parentId,
              })
              .from(comments)
              .where(eq(comments.id, parentIdToCheck))
              .limit(1);

            // Parent doesn't exist or isn't tombstoned — stop
            if (!parentComment || !parentComment.isDeleted) {
              break;
            }

            // Check if the tombstoned parent still has remaining children
            const [parentHasChildren] = await tx
              .select({ exists: sql<boolean>`EXISTS(SELECT 1 FROM comments WHERE parent_id = ${parentIdToCheck})` })
              .from(sql`(SELECT 1) AS _dummy`);

            if (parentHasChildren.exists) {
              // Parent still has other children — stop cleanup
              break;
            }

            // Parent is tombstoned with zero children — safe to hard-delete
            await tx
              .delete(comments)
              .where(eq(comments.id, parentIdToCheck));

            parentCleaned = true;
            // Move up the chain (at most one more level due to 2-level cap)
            parentIdToCheck = parentComment.parentId;
          }

          return { success: true as const, mode: parentCleaned ? "deleted+parent" as const : "deleted" as const };
        }
      });
    }),

  /** Upvote a comment — prevents duplicate votes, allows toggle */
  upvote: protectedProcedure
    .use(rateLimit("comments.upvote", 120, 3600))
    .input(z.object({
      commentId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.auth.dbUserId;

      const [comment] = await db
        .select({ id: comments.id })
        .from(comments)
        .where(eq(comments.id, input.commentId))
        .limit(1);

      if (!comment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Comment not found" });
      }

      return await db.transaction(async (tx) => {
        // Check existing vote
        const [existing] = await tx
          .select({ vote: commentVotes.vote })
          .from(commentVotes)
          .where(and(
            eq(commentVotes.userId, userId),
            eq(commentVotes.commentId, input.commentId)
          ))
          .limit(1);

        let userVote: string | null = 'upvote';

        if (existing?.vote === 'upvote') {
          // Toggle off: remove upvote
          await tx
            .delete(commentVotes)
            .where(and(
              eq(commentVotes.userId, userId),
              eq(commentVotes.commentId, input.commentId)
            ));
          userVote = null;
        } else if (existing?.vote === 'downvote') {
          // Switch from downvote to upvote
          await tx
            .update(commentVotes)
            .set({ vote: 'upvote' })
            .where(and(
              eq(commentVotes.userId, userId),
              eq(commentVotes.commentId, input.commentId)
            ));
        } else {
          // New upvote
          await tx
            .insert(commentVotes)
            .values({ userId, commentId: input.commentId, vote: 'upvote' });
        }

        // Atomic O(1) counter update — delta logic based on vote transition:
        // - no existing vote -> new upvote: dUp=+1, dDown=0, dScore=+1
        // - existing upvote -> toggle off (DELETE): dUp=-1, dDown=0, dScore=-1
        // - existing downvote -> switch to upvote (UPDATE): dUp=+1, dDown=-1, dScore=+2
        let dUp = 1;
        let dDown = 0;
        let dScore = 1;
        if (existing?.vote === 'upvote') {
          // Was toggled off above
          dUp = -1; dDown = 0; dScore = -1;
        } else if (existing?.vote === 'downvote') {
          // Switched from downvote to upvote above
          dUp = 1; dDown = -1; dScore = 2;
        }

        const [updated] = await tx
          .update(comments)
          .set({
            upvotes: sql`${comments.upvotes} + ${dUp}`,
            downvotes: sql`${comments.downvotes} + ${dDown}`,
            score: sql`${comments.score} + ${dScore}`,
          })
          .where(eq(comments.id, input.commentId))
          .returning({ upvotes: comments.upvotes, downvotes: comments.downvotes, score: comments.score });

        return { success: true, upvotes: updated.upvotes, downvotes: updated.downvotes, score: updated.score, userVote };
      });
    }),

  /** Downvote a comment — prevents duplicate votes, allows toggle */
  downvote: protectedProcedure
    .use(rateLimit("comments.downvote", 120, 3600))
    .input(z.object({
      commentId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.auth.dbUserId;

      const [comment] = await db
        .select({ id: comments.id })
        .from(comments)
        .where(eq(comments.id, input.commentId))
        .limit(1);

      if (!comment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Comment not found" });
      }

      return await db.transaction(async (tx) => {
        // Check existing vote
        const [existing] = await tx
          .select({ vote: commentVotes.vote })
          .from(commentVotes)
          .where(and(
            eq(commentVotes.userId, userId),
            eq(commentVotes.commentId, input.commentId)
          ))
          .limit(1);

        let userVote: string | null = 'downvote';

        if (existing?.vote === 'downvote') {
          // Toggle off: remove downvote
          await tx
            .delete(commentVotes)
            .where(and(
              eq(commentVotes.userId, userId),
              eq(commentVotes.commentId, input.commentId)
            ));
          userVote = null;
        } else if (existing?.vote === 'upvote') {
          // Switch from upvote to downvote
          await tx
            .update(commentVotes)
            .set({ vote: 'downvote' })
            .where(and(
              eq(commentVotes.userId, userId),
              eq(commentVotes.commentId, input.commentId)
            ));
        } else {
          // New downvote
          await tx
            .insert(commentVotes)
            .values({ userId, commentId: input.commentId, vote: 'downvote' });
        }

        // Atomic O(1) counter update — delta logic based on vote transition:
        // - no existing vote -> new downvote: dUp=0, dDown=+1, dScore=-1
        // - existing downvote -> toggle off (DELETE): dUp=0, dDown=-1, dScore=+1
        // - existing upvote -> switch to downvote (UPDATE): dUp=-1, dDown=+1, dScore=-2
        let dUp = 0;
        let dDown = 1;
        let dScore = -1;
        if (existing?.vote === 'downvote') {
          // Was toggled off above
          dUp = 0; dDown = -1; dScore = 1;
        } else if (existing?.vote === 'upvote') {
          // Switched from upvote to downvote above
          dUp = -1; dDown = 1; dScore = -2;
        }

        const [updated] = await tx
          .update(comments)
          .set({
            upvotes: sql`${comments.upvotes} + ${dUp}`,
            downvotes: sql`${comments.downvotes} + ${dDown}`,
            score: sql`${comments.score} + ${dScore}`,
          })
          .where(eq(comments.id, input.commentId))
          .returning({ upvotes: comments.upvotes, downvotes: comments.downvotes, score: comments.score });

        return { success: true, upvotes: updated.upvotes, downvotes: updated.downvotes, score: updated.score, userVote };
      });
    }),
});
