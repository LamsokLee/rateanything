/**
 * Tests for server/trpc.ts context creation and middleware guards.
 * Covers: createTRPCContext lazy user creation, placeholder username branches,
 *         adminProcedure FORBIDDEN guard, protectedProcedure UNAUTHORIZED guard.
 *
 * NOTE: Lines 111-128 (Clerk username update for placeholder users) are not
 * exercised because @clerk/nextjs/server is not mocked in integration tests.
 * That branch requires a real Clerk SDK call — the code catches errors and
 * proceeds gracefully, which is tested below via the new-user-creation catch.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { resetDb, createTestCaller, TEST_USERS } from "@/test/helpers";
import { createTRPCContext } from "@/server/trpc";
import { db, users, eq, sql } from "@rateanything/db";

beforeEach(resetDb);

describe("createTRPCContext", () => {
  it("returns unauth context when no clerkUserId provided", async () => {
    const ctx = await createTRPCContext({});
    expect(ctx.auth).toBeNull();
    expect(ctx.db).toBeDefined();
  });

  it("returns unauth context when clerkUserId is null", async () => {
    const ctx = await createTRPCContext({ clerkUserId: null });
    expect(ctx.auth).toBeNull();
  });

  it("returns auth context for existing user (TEST_USERS.regular)", async () => {
    const ctx = await createTRPCContext({ clerkUserId: TEST_USERS.regular.clerkId });
    expect(ctx.auth).not.toBeNull();
    expect(ctx.auth!.userId).toBe(TEST_USERS.regular.clerkId);
    expect(ctx.auth!.dbUserId).toBeDefined();
  });

  it("lazily creates a new user when clerkUserId is not in DB", async () => {
    // The Clerk API call will fail (no real Clerk in test env),
    // so it falls through to the catch block and uses placeholder username
    const newClerkId = "user_brand_new_12345678";
    const ctx = await createTRPCContext({ clerkUserId: newClerkId });

    expect(ctx.auth).not.toBeNull();
    expect(ctx.auth!.userId).toBe(newClerkId);

    // Verify user was created in DB with placeholder username
    const [created] = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, newClerkId))
      .limit(1);
    expect(created).toBeDefined();
    expect(created.username).toMatch(/^user_/);
  });

  it("existing user with placeholder username triggers Clerk update attempt (non-fatal catch)", async () => {
    // Create a user with short placeholder username (user_ + 8 chars = 13 chars total)
    const placeholderClerkId = "user_plh_testx";
    await db.insert(users).values({
      clerkId: placeholderClerkId,
      username: "user_testplhx", // 13 chars, starts with user_ — triggers update branch
      email: "plh@test.dev",
    });

    // Should not throw — the Clerk API failure is caught gracefully
    const ctx = await createTRPCContext({ clerkUserId: placeholderClerkId });
    expect(ctx.auth).not.toBeNull();
    expect(ctx.auth!.userId).toBe(placeholderClerkId);
  });
});

describe("protectedProcedure middleware", () => {
  it("throws UNAUTHORIZED for guest caller", async () => {
    const guest = await createTestCaller(null);
    await expect(guest.users.me()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("allows authenticated caller through", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const me = await caller.users.me();
    expect(me).not.toBeNull();
  });
});

describe("adminProcedure middleware", () => {
  it("throws UNAUTHORIZED for guest caller", async () => {
    const guest = await createTestCaller(null);
    await expect(
      guest.moderation.queue({ status: "pending" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("throws FORBIDDEN for non-admin authenticated user", async () => {
    const regular = await createTestCaller(TEST_USERS.regular.clerkId);
    await expect(
      regular.moderation.queue({ status: "pending" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows admin caller through", async () => {
    const admin = await createTestCaller(TEST_USERS.admin.clerkId);
    const result = await admin.moderation.queue({ status: "pending" });
    expect(result).toHaveProperty("reports");
  });
});
