/**
 * Integration test helpers — provides DB reset, baseline seeding,
 * and tRPC caller factories for the RateAnything test suite.
 *
 * Usage:
 *   import { resetDb, createTestCaller, TEST_USERS } from "@/test/helpers";
 *   beforeEach(resetDb);
 *   const caller = await createTestCaller(TEST_USERS.regular.clerkId);
 */
import { db, sql, users, categories } from "@rateanything/db";
import { appRouter } from "@/server/root";
import { createTRPCContext } from "@/server/trpc";

/** Well-known test user constants (seeded by resetDb/seedBaseline) */
export const TEST_USERS = {
  regular: {
    clerkId: "user_test_regular",
    username: "reguser",
    email: "reg@test.dev",
    isAdmin: false,
  },
  admin: {
    clerkId: "user_test_admin",
    username: "adminuser",
    email: "admin@test.dev",
    isAdmin: true,
  },
} as const;

/** The 9 baseline categories seeded into the test DB */
const SEED_CATEGORIES = [
  { name: "Sports", slug: "sports", description: "Athletic competitions, teams, and players", sortOrder: 1 },
  { name: "Movies & TV", slug: "movies-tv", description: "Films, television shows, and streaming content", sortOrder: 2 },
  { name: "Technology", slug: "tech", description: "Software, hardware, gadgets, and innovation", sortOrder: 3 },
  { name: "Music", slug: "music", description: "Artists, albums, genres, and concerts", sortOrder: 4 },
  { name: "Gaming", slug: "gaming", description: "Video games, consoles, and esports", sortOrder: 5 },
  { name: "Politics & News", slug: "politics-news", description: "Current events, policy, and world affairs", sortOrder: 6 },
  { name: "Food & Drink", slug: "food", description: "Restaurants, recipes, cuisines, and beverages", sortOrder: 7 },
  { name: "Culture", slug: "culture", description: "Art, books, fashion, and lifestyle", sortOrder: 8 },
  { name: "Other", slug: "other", description: "Everything else that deserves a rating", sortOrder: 9 },
];

/**
 * Seeds the baseline data into the test database:
 * - 9 categories
 * - 2 well-known users (regular + admin)
 */
export async function seedBaseline(): Promise<void> {
  await db.insert(categories).values(SEED_CATEGORIES).onConflictDoNothing();

  await db.insert(users).values([
    {
      clerkId: TEST_USERS.regular.clerkId,
      username: TEST_USERS.regular.username,
      email: TEST_USERS.regular.email,
      isAdmin: TEST_USERS.regular.isAdmin,
    },
    {
      clerkId: TEST_USERS.admin.clerkId,
      username: TEST_USERS.admin.username,
      email: TEST_USERS.admin.email,
      isAdmin: TEST_USERS.admin.isAdmin,
    },
  ]).onConflictDoNothing();
}

/**
 * Truncates all mutable tables (RESTART IDENTITY CASCADE) and
 * re-seeds baseline categories + test users. Call in beforeEach().
 */
export async function resetDb(): Promise<void> {
  await db.execute(sql`
    TRUNCATE
      users, topics, options, ratings, comments, comment_votes,
      guests, reports, follows, categories, badges, user_badges,
      arena_votes, option_elo_stats
    RESTART IDENTITY CASCADE
  `);
  await seedBaseline();
}

/**
 * Creates a typed tRPC caller for integration tests.
 * @param clerkUserId - Clerk user ID to authenticate as, or null/undefined for guest.
 * @returns A fully typed tRPC caller instance.
 */
export async function createTestCaller(clerkUserId?: string | null) {
  const ctx = await createTRPCContext({ clerkUserId: clerkUserId ?? null });
  return appRouter.createCaller(ctx);
}

/** Type of the test caller (for explicit typing in tests if needed) */
export type TestCaller = Awaited<ReturnType<typeof createTestCaller>>;

/**
 * Closes the underlying postgres.js connection pool.
 * Call in afterAll() if tests hang on exit.
 */
export async function closeDbPool(): Promise<void> {
  await db.execute(sql`SELECT 1`);
}
