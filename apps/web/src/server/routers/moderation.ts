/**
 * Moderation router — content reporting and admin moderation queue.
 */
import { z } from 'zod';
import { reportInputSchema } from '../schemas';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, adminProcedure } from '../trpc';
import { rateLimit } from '../rate-limit';
import {
  db, reports, users, topics, comments,
  eq, and, sql, desc,
} from '@rateanything/db';

export const moderationRouter = router({
  /** Report a piece of content */
  report: protectedProcedure
    .use(rateLimit("moderation.report", 10, 3600))
    .input(reportInputSchema)
    .mutation(async ({ ctx, input }) => {
      // Look up the internal user ID from the Clerk ID
      const [user] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.clerkId, ctx.auth.userId))
        .limit(1);

      if (!user) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }

      // Insert the report and check for auto-hide threshold (5 distinct reporters)
      const result = await db.transaction(async (tx) => {
        const [report] = await tx
          .insert(reports)
          .values({
            reporterId: user.id,
            targetType: input.targetType,
            targetId: input.targetId,
            reason: input.reason,
            details: input.details,
          })
          .returning({ id: reports.id, createdAt: reports.createdAt });

        // Recompute distinct reporter count from source of truth (reports table)
        const [{ count: reportCount }] = await tx
          .select({ count: sql<number>`count(DISTINCT ${reports.reporterId})::int` })
          .from(reports)
          .where(
            and(
              eq(reports.targetType, input.targetType),
              eq(reports.targetId, input.targetId)
            )
          );

        // Auto-hide at >= 5 distinct flags (see docs/DESIGN.md Section 11)
        if (reportCount >= 5) {
          if (input.targetType === 'topic') {
            await tx
              .update(topics)
              .set({ status: 'archived' })
              .where(eq(topics.id, input.targetId));
          } else if (input.targetType === 'comment') {
            await tx
              .update(comments)
              .set({ content: '[auto-hidden: community flagged]' })
              .where(eq(comments.id, input.targetId));
          }
          // ratings and users: no hidden/status column applicable for auto-hide
        }

        return report;
      });

      return { id: result.id, createdAt: result.createdAt };
    }),

  /** Get the moderation queue (admin only) with cursor pagination */
  queue: adminProcedure
    .input(z.object({
      status: z.enum(['pending', 'reviewing']).default('pending'),
      limit: z.number().int().min(1).max(50).default(20),
      cursor: z.string().optional(),
    }))
    .query(async ({ ctx: _ctx, input }) => {
      const { status, limit, cursor } = input;

      const conditions = [eq(reports.status, status)];

      // Decode cursor for keyset pagination by createdAt + id
      if (cursor) {
        const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString());
        conditions.push(
          sql`(${reports.createdAt}, ${reports.id}) < (${decoded.sortValue}::timestamptz, ${decoded.id})`
        );
      }

      const results = await db
        .select({
          id: reports.id,
          targetType: reports.targetType,
          targetId: reports.targetId,
          reason: reports.reason,
          details: reports.details,
          status: reports.status,
          createdAt: reports.createdAt,
          reporterId: users.id,
          reporterUsername: users.username,
          reporterAvatarUrl: users.avatarUrl,
        })
        .from(reports)
        .leftJoin(users, eq(reports.reporterId, users.id))
        .where(and(...conditions))
        .orderBy(desc(reports.createdAt), desc(reports.id))
        .limit(limit + 1);

      let nextCursor: string | null = null;
      if (results.length > limit) {
        const lastItem = results[limit - 1];
        nextCursor = Buffer.from(
          JSON.stringify({ id: lastItem.id, sortValue: lastItem.createdAt })
        ).toString('base64');
        results.pop();
      }

      return {
        reports: results.map((r) => ({
          id: r.id,
          targetType: r.targetType,
          targetId: r.targetId,
          reason: r.reason,
          details: r.details,
          status: r.status,
          createdAt: r.createdAt,
          reporter: r.reporterId ? {
            id: r.reporterId,
            username: r.reporterUsername,
            avatarUrl: r.reporterAvatarUrl,
          } : null,
        })),
        nextCursor,
      };
    }),

  /** Resolve a report (admin only) — take action on reported content */
  resolve: adminProcedure
    .input(z.object({
      reportId: z.string().uuid(),
      action: z.enum(['dismiss', 'warn', 'remove', 'ban']),
      note: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx: _ctx, input }) => {
      const { reportId, action } = input;

      // Fetch the report to get target info
      const [report] = await db
        .select()
        .from(reports)
        .where(eq(reports.id, reportId))
        .limit(1);

      if (!report) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Report not found' });
      }

      if (report.status === 'resolved' || report.status === 'dismissed') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Report already resolved' });
      }

      await db.transaction(async (tx) => {
        // Update report status to resolved or dismissed
        const resolvedStatus = action === 'dismiss' ? 'dismissed' : 'resolved';
        await tx
          .update(reports)
          .set({
            status: resolvedStatus,
            resolvedAt: new Date(),
          })
          .where(eq(reports.id, reportId));

        // Take action based on the moderation decision
        if (action === 'remove') {
          // Hide/remove the reported content based on target type
          switch (report.targetType) {
            case 'topic':
              await tx
                .update(topics)
                .set({ status: 'archived' })
                .where(eq(topics.id, report.targetId));
              break;
            case 'comment':
              await tx
                .update(comments)
                .set({ content: '[removed by moderator]' })
                .where(eq(comments.id, report.targetId));
              break;
            // Ratings: no status field in schema, leaving as-is for MVP
          }
        } else if (action === 'ban') {
          // If the target is a user, archive all their topics as a ban action
          if (report.targetType === 'user') {
            await tx
              .update(topics)
              .set({ status: 'archived' })
              .where(eq(topics.creatorId, report.targetId));
          }
        }
      });

      return { success: true, action };
    }),
});
