/**
 * Tests for username helper functions in trpc.ts:
 * - sanitizeUsername (lowercase, non-alphanumeric -> '_', collapse doubles,
 *   trim leading/trailing '_', truncate 50)
 * - deriveUsername (priority: clerk username -> email local-part -> user_<last8 of id>)
 * - ensureUniqueUsername (collision handling with real DB)
 *
 * NOTE: sanitizeUsername, deriveUsername, and ensureUniqueUsername are NOT exported
 * from trpc.ts. We test them via the observable effect of createTRPCContext
 * lazy-creation with a mocked '@clerk/nextjs/server' clerkClient.
 *
 * BUG: The Drizzle schema declares username as varchar(50), but the actual DB column
 * is varchar(30). sanitizeUsername truncates to 50, which can still exceed the DB limit.
 * Any username longer than 30 chars will fail at the DB level.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetDb } from "@/test/helpers";
import { db, users, eq } from "@rateanything/db";

// Mock clerkClient to return controlled user objects
const mockGetUser = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: vi.fn().mockResolvedValue({
    users: {
      getUser: (...args: unknown[]) => mockGetUser(...args),
    },
  }),
}));

beforeEach(async () => {
  await resetDb();
  mockGetUser.mockReset();
});

/** Import createTRPCContext (uses mocked clerkClient) */
async function getCreateTRPCContext() {
  const { createTRPCContext } = await import("@/server/trpc");
  return createTRPCContext;
}

/** Helper: configure mockGetUser to return a specific clerk user */
function setClerkUser(user: {
  id: string;
  username: string | null;
  emailAddresses: Array<{ emailAddress: string }>;
}) {
  mockGetUser.mockResolvedValue(user);
}

/** Helper: get the created user from DB by clerkId */
async function getCreatedUser(clerkId: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);
  return user;
}

describe("sanitizeUsername (via createTRPCContext)", () => {
  it("lowercases the username", async () => {
    setClerkUser({
      id: "user_clerk_lower",
      username: "HelloWorld",
      emailAddresses: [{ emailAddress: "hello@test.dev" }],
    });

    const createTRPCContext = await getCreateTRPCContext();
    await createTRPCContext({ clerkUserId: "user_clerk_lower" });

    const user = await getCreatedUser("user_clerk_lower");
    expect(user.username).toBe("helloworld");
  });

  it("replaces non-alphanumeric characters with underscores", async () => {
    setClerkUser({
      id: "user_clerk_special",
      username: "hi@world!9",
      emailAddresses: [{ emailAddress: "x@test.dev" }],
    });

    const createTRPCContext = await getCreateTRPCContext();
    await createTRPCContext({ clerkUserId: "user_clerk_special" });

    const user = await getCreatedUser("user_clerk_special");
    expect(user.username).toBe("hi_world_9");
  });

  it("collapses double underscores", async () => {
    setClerkUser({
      id: "user_clerk_double",
      username: "foo__bar___baz",
      emailAddresses: [{ emailAddress: "x@test.dev" }],
    });

    const createTRPCContext = await getCreateTRPCContext();
    await createTRPCContext({ clerkUserId: "user_clerk_double" });

    const user = await getCreatedUser("user_clerk_double");
    expect(user.username).toBe("foo_bar_baz");
  });

  it("trims leading and trailing underscores", async () => {
    setClerkUser({
      id: "user_clerk_trim",
      username: "_leading_trailing_",
      emailAddresses: [{ emailAddress: "x@test.dev" }],
    });

    const createTRPCContext = await getCreateTRPCContext();
    await createTRPCContext({ clerkUserId: "user_clerk_trim" });

    const user = await getCreatedUser("user_clerk_trim");
    expect(user.username).toBe("leading_trailing");
  });

  // FIXED: sanitizeUsername now truncates to 30 chars matching DB varchar(30).
  it("sanitizeUsername truncates to 30 chars (matching DB varchar(30))", async () => {
    const longName = "a".repeat(35); // sanitize now truncates to 30
    setClerkUser({
      id: "user_clerk_long",
      username: longName,
      emailAddresses: [{ emailAddress: "x@test.dev" }],
    });

    const createTRPCContext = await getCreateTRPCContext();
    // Should succeed — sanitizeUsername truncates to 30 chars before DB insert
    const ctx = await createTRPCContext({ clerkUserId: "user_clerk_long" });
    expect(ctx.auth).not.toBeNull();

    const user = await getCreatedUser("user_clerk_long");
    expect(user.username.length).toBeLessThanOrEqual(30);
    expect(user.username).toBe("a".repeat(30));
  });

  it("usernames at exactly 30 chars are accepted by the DB", async () => {
    const name30 = "a".repeat(30);
    setClerkUser({
      id: "user_clerk_30",
      username: name30,
      emailAddresses: [{ emailAddress: "x@test.dev" }],
    });

    const createTRPCContext = await getCreateTRPCContext();
    await createTRPCContext({ clerkUserId: "user_clerk_30" });

    const user = await getCreatedUser("user_clerk_30");
    expect(user.username).toBe(name30);
    expect(user.username.length).toBe(30);
  });
});

describe("deriveUsername (via createTRPCContext)", () => {
  it("uses clerk username when available (priority 1)", async () => {
    setClerkUser({
      id: "user_clerk_derive1",
      username: "mypreferred",
      emailAddresses: [{ emailAddress: "other@test.dev" }],
    });

    const createTRPCContext = await getCreateTRPCContext();
    await createTRPCContext({ clerkUserId: "user_clerk_derive1" });

    const user = await getCreatedUser("user_clerk_derive1");
    expect(user.username).toBe("mypreferred");
  });

  it("falls back to email local-part when username is null (priority 2)", async () => {
    setClerkUser({
      id: "user_clerk_derive2",
      username: null,
      emailAddresses: [{ emailAddress: "johndoe@example.com" }],
    });

    const createTRPCContext = await getCreateTRPCContext();
    await createTRPCContext({ clerkUserId: "user_clerk_derive2" });

    const user = await getCreatedUser("user_clerk_derive2");
    expect(user.username).toBe("johndoe");
  });

  it("falls back to user_<last8 of id> when no username and no email (priority 3)", async () => {
    setClerkUser({
      id: "user_abcdefghijklmnop",
      username: null,
      emailAddresses: [],
    });

    const createTRPCContext = await getCreateTRPCContext();
    await createTRPCContext({ clerkUserId: "user_abcdefghijklmnop" });

    const user = await getCreatedUser("user_abcdefghijklmnop");
    // "user_abcdefghijklmnop".slice(-8) = "ijklmnop"
    expect(user.username).toBe("user_ijklmnop");
  });

  it("sanitizes email local-part (special chars become underscores)", async () => {
    setClerkUser({
      id: "user_clerk_derive4",
      username: null,
      emailAddresses: [{ emailAddress: "john.doe+tag@example.com" }],
    });

    const createTRPCContext = await getCreateTRPCContext();
    await createTRPCContext({ clerkUserId: "user_clerk_derive4" });

    const user = await getCreatedUser("user_clerk_derive4");
    // john.doe+tag -> john_doe_tag (dots and plus become _)
    expect(user.username).toBe("john_doe_tag");
  });
});

describe("ensureUniqueUsername (collision handling via real DB)", () => {
  it("appends a suffix when username collides with existing user", async () => {
    // Seed a user with username "collide"
    await db.insert(users).values({
      clerkId: "user_existing_collision",
      username: "collide",
      email: "existing@test.dev",
    });

    setClerkUser({
      id: "user_clerk_collision",
      username: "collide",
      emailAddresses: [{ emailAddress: "new@test.dev" }],
    });

    const createTRPCContext = await getCreateTRPCContext();
    await createTRPCContext({ clerkUserId: "user_clerk_collision" });

    const user = await getCreatedUser("user_clerk_collision");
    // Username should NOT be the same as the existing one
    expect(user.username).not.toBe("collide");
    // Should start with "collide" prefix (with a suffix appended)
    expect(user.username).toMatch(/^collide_[a-z0-9]+$/);
  });

  it("generated username is unique in the DB", async () => {
    // Seed a user with username "unique_chk"
    await db.insert(users).values({
      clerkId: "user_existing_unique",
      username: "unique_chk",
      email: "existing2@test.dev",
    });

    setClerkUser({
      id: "user_clerk_unique_check",
      username: "unique_chk",
      emailAddresses: [{ emailAddress: "new2@test.dev" }],
    });

    const createTRPCContext = await getCreateTRPCContext();
    await createTRPCContext({ clerkUserId: "user_clerk_unique_check" });

    // Verify no duplicate usernames exist
    const allUsers = await db.select({ username: users.username }).from(users);
    const usernames = allUsers.map((u) => u.username);
    const uniqueUsernames = new Set(usernames);
    expect(uniqueUsernames.size).toBe(usernames.length);
  });
});
