/**
 * Arena schema — immutable comparison event log + cached Elo stats.
 * Source of truth is `arena_votes`; `option_elo_stats` is a denormalized cache.
 *
 * CANONICAL ORDERING INVARIANT:
 * All rows in arena_votes store option_a_id < option_b_id (by UUID string sort).
 * This is enforced by:
 *   1. CHECK constraint `chk_arena_canonical_order` at DB level
 *   2. Server-side normalization before INSERT (in the vote procedure)
 * The winner_option_id column records which side actually won.
 *
 * DUPLICATE PREVENTION:
 * A UNIQUE index on (topic_id, user_id, option_a_id, option_b_id) or
 * (topic_id, guest_id, option_a_id, option_b_id) prevents any voter from
 * voting on the same unordered pair more than once.
 * Re-votes are rejected (idempotent no-op), NOT re-applied to Elo.
 *
 * Design decisions addressing review blockers:
 * - CHECK (option_a_id::text < option_b_id::text) enforces canonical pair ordering at DB level (Blocker #1)
 * - elo_*_before values are always the fresh values read inside the FOR UPDATE lock,
 *   NOT stale values from getPair or client input (Blocker #2)
 * - Schema is pushed via `drizzle-kit push` (project convention — no versioned migrations) (Blocker #3)
 */
import {
  pgTable, uuid, text, integer, real, timestamp,
  index, unique, check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { options } from "./options.js";
import { topics } from "./topics.js";
import { users } from "./users.js";
import { guests } from "./guests.js";

/**
 * arena_votes — immutable event log of pairwise comparisons.
 * Each row records: who voted, which topic, two options shown (canonical order), who won.
 * winner_option_id = NULL means "skip" (no Elo change).
 *
 * CANONICAL ORDER: option_a_id < option_b_id (enforced by CHECK + server logic).
 * This ensures the UNIQUE constraint works for unordered pairs.
 */
export const arenaVotes = pgTable("arena_votes", {
  id: uuid("id").primaryKey().defaultRandom(),
  topicId: uuid("topic_id").notNull().references(() => topics.id, { onDelete: "cascade" }),
  /** Always the lesser UUID of the pair (canonical order) */
  optionAId: uuid("option_a_id").notNull().references(() => options.id, { onDelete: "cascade" }),
  /** Always the greater UUID of the pair (canonical order) */
  optionBId: uuid("option_b_id").notNull().references(() => options.id, { onDelete: "cascade" }),
  /** The option that won; NULL = skipped pair (no Elo delta) */
  winnerOptionId: uuid("winner_option_id").references(() => options.id, { onDelete: "set null" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  guestId: uuid("guest_id").references(() => guests.id, { onDelete: "set null" }),
  /** Elo ratings at time of vote — always from the transactional FOR UPDATE read */
  eloABefore: real("elo_a_before").notNull(),
  eloBBefore: real("elo_b_before").notNull(),
  eloAAfter: real("elo_a_after").notNull(),
  eloBAfter: real("elo_b_after").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  /** CHECK: exactly one of user_id or guest_id must be non-null (same pattern as ratings) */
  voterCheck: check("chk_arena_voter", sql`(user_id IS NOT NULL AND guest_id IS NULL) OR (user_id IS NULL AND guest_id IS NOT NULL)`),
  /** CHECK: A != B */
  pairCheck: check("chk_arena_pair_different", sql`option_a_id <> option_b_id`),
  /** CHECK: canonical ordering — option_a_id must be lexicographically less than option_b_id */
  canonicalOrderCheck: check("chk_arena_canonical_order", sql`option_a_id::text < option_b_id::text`),
  /** CHECK: winner must be one of the two options in the pair (S3 from review) */
  winnerInPairCheck: check("chk_arena_winner_in_pair", sql`winner_option_id IS NULL OR winner_option_id IN (option_a_id, option_b_id)`),
  /**
   * UNIQUE: one vote per authenticated user per unordered pair per topic.
   * Enforces "Elo applied exactly once per (voter, unordered pair)".
   * Duplicate INSERT raises unique_violation → caught → idempotent no-op.
   */
  userPairUniq: unique("uq_arena_user_pair").on(table.topicId, table.userId, table.optionAId, table.optionBId),
  /**
   * UNIQUE: one vote per guest per unordered pair per topic.
   * Same semantics as userPairUniq but for guest identity.
   */
  guestPairUniq: unique("uq_arena_guest_pair").on(table.topicId, table.guestId, table.optionAId, table.optionBId),
  /** For leaderboard recalc / replay queries ordered by time */
  topicCreatedIdx: index("idx_arena_votes_topic_created").on(table.topicId, table.createdAt),
  /** For user vote history queries */
  userIdx: index("idx_arena_votes_user").on(table.userId),
  /** For guest vote history and rate-limit queries */
  guestIdx: index("idx_arena_votes_guest").on(table.guestId),
}));

/**
 * option_elo_stats — cached Elo rating per option per topic.
 * Materialized from arena_votes via transactional updates on each vote.
 * Can be fully rebuilt by replaying the event log.
 *
 * INITIALIZATION: Rows are created via ON CONFLICT DO NOTHING upsert when
 * options are first encountered (either via getPair or at option creation time).
 * The vote transaction locks these rows FOR UPDATE ORDER BY option_id ASC
 * to prevent deadlocks.
 */
export const optionEloStats = pgTable("option_elo_stats", {
  id: uuid("id").primaryKey().defaultRandom(),
  topicId: uuid("topic_id").notNull().references(() => topics.id, { onDelete: "cascade" }),
  optionId: uuid("option_id").notNull().references(() => options.id, { onDelete: "cascade" }),
  eloRating: real("elo_rating").default(1500).notNull(),
  matchCount: integer("match_count").default(0).notNull(),
  winCount: integer("win_count").default(0).notNull(),
  lossCount: integer("loss_count").default(0).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  /** One Elo row per option per topic */
  topicOptionUniq: unique("uq_elo_topic_option").on(table.topicId, table.optionId),
  /** Leaderboard query: ORDER BY elo_rating DESC within a topic */
  leaderboardIdx: index("idx_elo_leaderboard").on(table.topicId, table.eloRating),
}));

// --- Relations ---

export const arenaVotesRelations = relations(arenaVotes, ({ one }) => ({
  topic: one(topics, { fields: [arenaVotes.topicId], references: [topics.id] }),
  optionA: one(options, { fields: [arenaVotes.optionAId], references: [options.id] }),
  optionB: one(options, { fields: [arenaVotes.optionBId], references: [options.id] }),
  user: one(users, { fields: [arenaVotes.userId], references: [users.id] }),
  guest: one(guests, { fields: [arenaVotes.guestId], references: [guests.id] }),
}));

export const optionEloStatsRelations = relations(optionEloStats, ({ one }) => ({
  topic: one(topics, { fields: [optionEloStats.topicId], references: [topics.id] }),
  option: one(options, { fields: [optionEloStats.optionId], references: [options.id] }),
}));

// --- Type Exports ---

export type ArenaVote = typeof arenaVotes.$inferSelect;
export type NewArenaVote = typeof arenaVotes.$inferInsert;
export type OptionEloStat = typeof optionEloStats.$inferSelect;
export type NewOptionEloStat = typeof optionEloStats.$inferInsert;
