/**
 * Comment votes table — tracks which users upvoted/downvoted comments.
 * Composite PK prevents duplicate votes. Vote can be 'upvote' or 'downvote'.
 */
import { pgTable, uuid, varchar, timestamp, primaryKey } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users.js';
import { comments } from './comments.js';

export const commentVotes = pgTable('comment_votes', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  commentId: uuid('comment_id').notNull().references(() => comments.id, { onDelete: 'cascade' }),
  vote: varchar('vote', { length: 10 }).notNull(), // 'upvote' or 'downvote'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.commentId] }),
}));

export const commentVotesRelations = relations(commentVotes, ({ one }) => ({
  user: one(users, {
    fields: [commentVotes.userId],
    references: [users.id],
  }),
  comment: one(comments, {
    fields: [commentVotes.commentId],
    references: [comments.id],
  }),
}));

export type CommentVote = typeof commentVotes.$inferSelect;
