/**
 * Users table — authenticated users via Clerk.
 * Stores profile data, reputation metrics, and social counts.
 */
import { pgTable, uuid, varchar, text, boolean, integer, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  clerkId: varchar('clerk_id', { length: 255 }).notNull().unique(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull(),
  avatarUrl: text('avatar_url'),
  bio: varchar('bio', { length: 500 }),
  location: varchar('location', { length: 100 }),
  isVerified: boolean('is_verified').default(false).notNull(),
  isAdmin: boolean('is_admin').default(false).notNull(),
  reputation: integer('reputation').default(0).notNull(),
  ratingCount: integer('rating_count').default(0).notNull(),
  followerCount: integer('follower_count').default(0).notNull(),
  followingCount: integer('following_count').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  topics: many(users, { relationName: 'userTopics' }),
  ratings: many(users, { relationName: 'userRatings' }),
  notifications: many(users, { relationName: 'userNotifications' }),
  collections: many(users, { relationName: 'userCollections' }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
