/**
 * Topics table — the core entity users rate options within.
 * Includes status enum, trending score, and comprehensive indexing.
 */
import {
  pgTable, pgEnum, uuid, varchar, text, integer, boolean,
  real, timestamp, index,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { categories } from './categories.js';
import { users } from './users.js';

/** Topic lifecycle status */
export const topicStatusEnum = pgEnum('topic_status', ['draft', 'active', 'closed', 'archived']);

export const topics = pgTable('topics', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 200 }).notNull(),
  slug: varchar('slug', { length: 220 }).notNull().unique(),
  description: text('description'),
  categoryId: integer('category_id').references(() => categories.id, { onDelete: 'set null' }),
  imageUrl: text('image_url'),
  sourceUrl: text('source_url'),
  creatorId: uuid('creator_id').references(() => users.id, { onDelete: 'set null' }),
  status: topicStatusEnum('status').default('active').notNull(),
  allowNewOptions: boolean('allow_new_options').default(true).notNull(),
  totalRatings: integer('total_ratings').default(0).notNull(),
  trendingScore: real('trending_score').default(0).notNull(),
  isPinned: boolean('is_pinned').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  lastActivity: timestamp('last_activity', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  /** Composite index for category listing sorted by trending score */
  categoryTrendingIdx: index('idx_topics_category_trending').on(table.categoryId, table.trendingScore),
  /** Recent topics listing */
  createdAtIdx: index('idx_topics_created_at').on(table.createdAt),
  /** Partial index for active topics only */
  statusIdx: index('idx_topics_status').on(table.status).where(sql`status = 'active'`),
  /**
   * Trigram GIN index for fuzzy text search on title.
   * NOTE: Requires pg_trgm extension: CREATE EXTENSION IF NOT EXISTS pg_trgm;
   * Drizzle will create this as a regular index — run the raw SQL for GIN in a migration.
   */
  trgmIdx: index('idx_topics_trgm').using('gin', sql`title gin_trgm_ops`),
}));

export const topicsRelations = relations(topics, ({ one }) => ({
  category: one(categories, {
    fields: [topics.categoryId],
    references: [categories.id],
  }),
  creator: one(users, {
    fields: [topics.creatorId],
    references: [users.id],
  }),
}));

export type Topic = typeof topics.$inferSelect;
export type NewTopic = typeof topics.$inferInsert;
