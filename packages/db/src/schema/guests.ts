/**
 * Guests table — anonymous users identified by browser fingerprint.
 * Allows rating without account creation with rate-limiting support.
 */
import { pgTable, uuid, varchar, text, integer, timestamp } from 'drizzle-orm/pg-core';

export const guests = pgTable('guests', {
  id: uuid('id').primaryKey().defaultRandom(),
  fingerprintHash: varchar('fingerprint_hash', { length: 64 }).notNull().unique(),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  ratingCount: integer('rating_count').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  lastSeen: timestamp('last_seen', { withTimezone: true }).defaultNow().notNull(),
});

export type Guest = typeof guests.$inferSelect;
export type NewGuest = typeof guests.$inferInsert;
