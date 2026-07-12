/**
 * Comments table — threaded discussions on ratings and topics.
 * Supports nested replies via self-referencing parent_id.
 * Comments can be attached to a rating OR directly to a topic.
 */
import {
  pgTable, uuid, varchar, integer, timestamp, index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { ratings } from './ratings.js';
import { users } from './users.js';
import { topics } from './topics.js';

export const comments = pgTable('comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  ratingId: uuid('rating_id').references(() => ratings.id, { onDelete: 'cascade' }),
  topicId: uuid('topic_id').references(() => topics.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  parentId: uuid('parent_id').references((): any => comments.id, { onDelete: 'cascade' }),
  content: varchar('content', { length: 500 }).notNull(),
  upvotes: integer('upvotes').default(0).notNull(),
  downvotes: integer('downvotes').default(0).notNull(),
  score: integer('score').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  /** Index for fetching comments by rating, sorted by upvotes */
  ratingIdx: index('idx_comments_rating').on(table.ratingId, table.upvotes),
  /** Index for fetching child replies */
  parentIdx: index('idx_comments_parent').on(table.parentId),
  /** Index for fetching comments by user, sorted by createdAt DESC */
  userCreatedIdx: index('idx_comments_user_created').on(table.userId, table.createdAt),
  /** Index for fetching comments by topic */
  topicIdx: index('idx_comments_topic_drizzle').on(table.topicId, table.upvotes),
}));

export const commentsRelations = relations(comments, ({ one, many }) => ({
  rating: one(ratings, {
    fields: [comments.ratingId],
    references: [ratings.id],
  }),
  topic: one(topics, {
    fields: [comments.topicId],
    references: [topics.id],
  }),
  user: one(users, {
    fields: [comments.userId],
    references: [users.id],
  }),
  parent: one(comments, {
    fields: [comments.parentId],
    references: [comments.id],
    relationName: 'commentReplies',
  }),
  replies: many(comments, { relationName: 'commentReplies' }),
}));

export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;
