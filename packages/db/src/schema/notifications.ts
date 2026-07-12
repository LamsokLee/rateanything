/**
 * Notifications table — user-facing notifications for activity (new ratings, follows, etc.).
 * Partial index on unread notifications for efficient badge count queries.
 */
import {
  pgTable, uuid, varchar, jsonb, boolean, timestamp, index,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { users } from './users.js';

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 50 }).notNull(),
  data: jsonb('data'),
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  /** Partial index: only unread notifications for fast badge count */
  userUnreadIdx: index('idx_notifications_user_unread')
    .on(table.userId, table.isRead)
    .where(sql`is_read = false`),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
