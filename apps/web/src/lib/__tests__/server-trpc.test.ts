/**
 * Unit tests for lib/server-trpc.ts — getServerCaller factory.
 * Verifies that getServerCaller creates callers in both authed and guest modes.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { resetDb, TEST_USERS } from "@/test/helpers";
import { getServerCaller } from "@/lib/server-trpc";

beforeEach(resetDb);

describe("getServerCaller", () => {
  it("creates an authenticated caller that can call protected procedures", async () => {
    const caller = await getServerCaller(TEST_USERS.regular.clerkId);
    // me is a protected procedure — should succeed with authed caller
    const me = await caller.users.me();
    expect(me).not.toBeNull();
    expect(me!.username).toBe(TEST_USERS.regular.username);
  });

  it("creates a guest caller (no clerkUserId) that can call public procedures", async () => {
    const caller = await getServerCaller();
    // categories.list is public — should work with guest caller
    const trending = await caller.topics.trending({ limit: 5 });
    expect(trending).toHaveProperty("topics");
  });

  it("guest caller rejects protected procedures with UNAUTHORIZED", async () => {
    const caller = await getServerCaller();
    await expect(caller.users.me()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("creates an authenticated caller with explicit undefined (treated as guest)", async () => {
    const caller = await getServerCaller(undefined);
    await expect(caller.users.me()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
