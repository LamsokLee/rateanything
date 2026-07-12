/**
 * Options table — individual items within a topic that can be rated.
 * Each option belongs to a topic and tracks its own aggregate rating stats.
 */
import {
  pgTable, uuid, varchar, text, integer, real, timestamp, index, unique,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { topics } from './topics.js';

export const options = pgTable('options', {
  id: uuid('id').primaryKey().defaultRandom(),
  topicId: uuid('topic_id').notNull().references(() => topics.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  imageUrl: text('image_url'),
  sortOrder: integer('sort_order').default(0).notNull(),
  avgRating: real('avg_rating').default(0).notNull(),
  ratingCount: integer('rating_count').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  /** Unique constraint: no duplicate option names within a topic */
  topicNameUniq: unique('uq_options_topic_name').on(table.topicId, table.name),
  /** Index for listing options within a topic in order */
  topicIdx: index('idx_options_topic').on(table.topicId, table.sortOrder),
}));

export const optionsRelations = relations(options, ({ one }) => ({
  topic: one(topics, {
    fields: [options.topicId],
    references: [topics.id],
  }),
}));

export type Option = typeof options.$inferSelect;
export type NewOption = typeof options.$inferInsert;
