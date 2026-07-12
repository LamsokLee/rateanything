/**
 * Ratings table — individual score submissions (1-10) for an option.
 * Supports both authenticated users and guests.
 * CHECK constraint ensures exactly one of user_id/guest_id is set.
 * Unique constraints prevent duplicate ratings per user/guest per option.
 */
import {
  pgTable, uuid, varchar, text, smallint, boolean, timestamp,
  index, unique, check,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { options } from './options.js';
import { users } from './users.js';
import { guests } from './guests.js';

export const ratings = pgTable('ratings', {
  id: uuid('id').primaryKey().defaultRandom(),
  optionId: uuid('option_id').notNull().references(() => options.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  guestId: uuid('guest_id').references(() => guests.id, { onDelete: 'set null' }),
  score: smallint('score').notNull(),
  comment: text('comment'),
  tags: text('tags').array(),
  isEdited: boolean('is_edited').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  /** One rating per authenticated user per option */
  userOptionUniq: unique('uq_ratings_user_option').on(table.userId, table.optionId),
  /** One rating per guest per option */
  guestOptionUniq: unique('uq_ratings_guest_option').on(table.guestId, table.optionId),
  /** CHECK: exactly one of user_id or guest_id must be non-null */
  raterCheck: check('chk_ratings_rater', sql`(user_id IS NOT NULL AND guest_id IS NULL) OR (user_id IS NULL AND guest_id IS NOT NULL)`),
  /** Index for fetching ratings by option, newest first */
  optionCreatedIdx: index('idx_ratings_option_created').on(table.optionId, table.createdAt),
  /** Index for looking up a user's ratings */
  userIdx: index('idx_ratings_user').on(table.userId),
  /** Index for looking up a guest's ratings */
  guestIdx: index('idx_ratings_guest').on(table.guestId),
}));

export const ratingsRelations = relations(ratings, ({ one }) => ({
  option: one(options, {
    fields: [ratings.optionId],
    references: [options.id],
  }),
  user: one(users, {
    fields: [ratings.userId],
    references: [users.id],
  }),
  guest: one(guests, {
    fields: [ratings.guestId],
    references: [guests.id],
  }),
}));

export type Rating = typeof ratings.$inferSelect;
export type NewRating = typeof ratings.$inferInsert;
