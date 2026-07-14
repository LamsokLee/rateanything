/**
 * Reports table — user-submitted content moderation reports.
 * Supports reporting topics, ratings, comments, and users.
 */
import {
  pgTable, pgEnum, uuid, varchar, text, timestamp, index,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { users } from './users.js';

/** What type of entity is being reported */
export const reportTargetTypeEnum = pgEnum('report_target_type', [
  'topic', 'rating', 'comment', 'user',
]);

/** Moderation workflow status */
export const reportStatusEnum = pgEnum('report_status', [
  'pending', 'reviewed', 'actioned', 'dismissed', 'appealed',
]);

export const reports = pgTable('reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  reporterId: uuid('reporter_id').references(() => users.id, { onDelete: 'set null' }),
  targetType: reportTargetTypeEnum('target_type').notNull(),
  targetId: uuid('target_id').notNull(),
  reason: varchar('reason', { length: 100 }).notNull(),
  details: text('details'),
  status: reportStatusEnum('status').default('pending').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
}, (table) => ({
  /** Partial index for pending reports (moderation queue) */
  statusIdx: index('idx_reports_status')
    .on(table.status)
    .where(sql`status = 'pending'`),
}));

export const reportsRelations = relations(reports, ({ one }) => ({
  reporter: one(users, {
    fields: [reports.reporterId],
    references: [users.id],
  }),
}));

export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;
