/**
 * Integration tests for the users router.
 * Covers: me, getProfile, getRatingHistory, getCommentHistory, getCreatedTopics,
 *         follow, unfollow, deleteAccount
 */
import { describe, it, expect, beforeEach } from "vitest";
import { resetDb, createTestCaller, TEST_USERS } from "@/test/helpers";
import {
  db, sql, users, follows, comments, ratings, options, topics,
  eq, and,
} from "@rateanything/db";

beforeEach(resetDb);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Gets a user row by clerkId directly from DB */
async function getUserByClerkId(clerkId: string) {
  const [row] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  return row ?? null;
}

/** Creates a topic directly for seeding, returns { topicId, optionIds, slug } */
async function seedTopic(
  caller: Awaited<ReturnType<typeof createTestCaller>>,
  title: string,
  opts: string[] = ["Option A", "Option B"],
) {
  const result = await caller.topics.create({
    title,
    categoryId: 1,
    options: opts.map((name) => ({ name })),
  });
  // Fetch the topic and options from DB
  const [topic] = await db.select().from(topics).where(eq(topics.slug, result.slug)).limit(1);
  const topicOptions = await db
    .select()
    .from(options)
    .where(eq(options.topicId, topic.id));
  return { topicId: topic.id, slug: result.slug, optionIds: topicOptions.map((o) => o.id) };
}

// ─── users.me ─────────────────────────────────────────────────────────────────

describe("users.me", () => {
  it("returns the current user profile for authenticated user", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const result = await caller.users.me();

    expect(result).not.toBeNull();
    expect(result!.username).toBe(TEST_USERS.regular.username);
    expect(result!.id).toBeDefined();
    expect(result).toHaveProperty("avatarUrl");
    expect(result).toHaveProperty("bio");
  });

  it("returns admin user profile for admin caller", async () => {
    const caller = await createTestCaller(TEST_USERS.admin.clerkId);
    const result = await caller.users.me();

    expect(result).not.toBeNull();
    expect(result!.username).toBe(TEST_USERS.admin.username);
  });

  it("rejects guest caller with UNAUTHORIZED", async () => {
    const guest = await createTestCaller(null);
    await expect(guest.users.me()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});

// ─── users.getProfile ─────────────────────────────────────────────────────────

describe("users.getProfile", () => {
  it("returns public profile with counts and fields", async () => {
    const caller = await createTestCaller(null);
    const result = await caller.users.getProfile({ username: TEST_USERS.regular.username });

    expect(result.username).toBe(TEST_USERS.regular.username);
    expect(result.id).toBeDefined();
    expect(result).toHaveProperty("reputation");
    expect(result).toHaveProperty("ratingCount");
    expect(result).toHaveProperty("followerCount");
    expect(result).toHaveProperty("followingCount");
    expect(result).toHaveProperty("avatarUrl");
    expect(result).toHaveProperty("bio");
    expect(result).toHaveProperty("location");
    expect(result).toHaveProperty("isVerified");
    expect(result).toHaveProperty("createdAt");
    expect(result).toHaveProperty("badges");
    expect(Array.isArray(result.badges)).toBe(true);
  });

  it("throws NOT_FOUND for unknown username", async () => {
    const caller = await createTestCaller(null);
    await expect(
      caller.users.getProfile({ username: "nonexistent_user_xyz" })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("returns followerCount reflecting actual follow relationships", async () => {
    // regular follows admin
    const regularCaller = await createTestCaller(TEST_USERS.regular.clerkId);
    const admin = await getUserByClerkId(TEST_USERS.admin.clerkId);
    await regularCaller.users.follow({ targetUserId: admin!.id });

    const guest = await createTestCaller(null);
    const profile = await guest.users.getProfile({ username: TEST_USERS.admin.username });
    expect(profile.followerCount).toBe(1);
  });
});

// ─── users.getRatingHistory ───────────────────────────────────────────────────

describe("users.getRatingHistory", () => {
  it("returns rating history items with expected shape", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { optionIds, slug } = await seedTopic(caller, "Rating History Topic");

    // Submit a rating
    await caller.ratings.submit({ optionId: optionIds[0], score: 8 });

    const history = await caller.users.getRatingHistory({
      username: TEST_USERS.regular.username,
    });

    expect(history.items.length).toBe(1);
    expect(history.items[0]).toMatchObject({
      topicSlug: slug,
      topicTitle: "Rating History Topic",
      optionName: expect.any(String),
      score: 8,
    });
    expect(history.items[0].createdAt).toBeDefined();
  });

  it("returns items ordered recent-first", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { optionIds } = await seedTopic(caller, "Order Test Topic", ["First", "Second"]);

    await caller.ratings.submit({ optionId: optionIds[0], score: 3 });
    // Small delay to ensure different timestamps
    await new Promise((r) => setTimeout(r, 50));
    await caller.ratings.submit({ optionId: optionIds[1], score: 9 });

    const history = await caller.users.getRatingHistory({
      username: TEST_USERS.regular.username,
    });

    expect(history.items.length).toBe(2);
    // Most recent first
    expect(history.items[0].score).toBe(9);
    expect(history.items[1].score).toBe(3);
  });

  it("returns empty items for user with no ratings", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const history = await caller.users.getRatingHistory({
      username: TEST_USERS.regular.username,
    });
    expect(history.items).toEqual([]);
    expect(history.nextCursor).toBeNull();
  });

  it("enforces limit cap of 50", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    await expect(
      caller.users.getRatingHistory({
        username: TEST_USERS.regular.username,
        limit: 51,
      })
    ).rejects.toThrow();
  });

  it("throws NOT_FOUND for unknown username", async () => {
    const caller = await createTestCaller(null);
    await expect(
      caller.users.getRatingHistory({ username: "ghost_user_123" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("supports cursor-based pagination", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    // Create a topic with 3 options to rate
    const { optionIds } = await seedTopic(caller, "Pagination Topic", ["A", "B", "C"]);

    for (let i = 0; i < optionIds.length; i++) {
      await caller.ratings.submit({ optionId: optionIds[i], score: i + 1 });
      await new Promise((r) => setTimeout(r, 20));
    }

    // Get first page with limit 2
    const page1 = await caller.users.getRatingHistory({
      username: TEST_USERS.regular.username,
      limit: 2,
    });
    expect(page1.items.length).toBe(2);
    expect(page1.nextCursor).not.toBeNull();

    // Get second page
    const page2 = await caller.users.getRatingHistory({
      username: TEST_USERS.regular.username,
      limit: 2,
      cursor: page1.nextCursor!,
    });
    expect(page2.items.length).toBe(1);
    expect(page2.nextCursor).toBeNull();

    // No overlap
    const allScores = [...page1.items, ...page2.items].map((i) => i.score);
    expect(new Set(allScores).size).toBe(3);
  });
});

// ─── users.getCommentHistory ──────────────────────────────────────────────────

describe("users.getCommentHistory", () => {
  it("returns comment history items with expected shape", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { topicId } = await seedTopic(caller, "Comment History Topic");

    // Create a comment on the topic
    await caller.comments.create({
      topicId,
      content: "Great topic discussion!",
    });

    const history = await caller.users.getCommentHistory({
      username: TEST_USERS.regular.username,
    });

    expect(history.items.length).toBe(1);
    expect(history.items[0]).toMatchObject({
      content: "Great topic discussion!",
      topicTitle: "Comment History Topic",
    });
    expect(history.items[0].id).toBeDefined();
    expect(history.items[0].createdAt).toBeDefined();
    expect(history.items[0]).toHaveProperty("score");
    expect(history.items[0]).toHaveProperty("topicSlug");
  });

  it("returns items ordered recent-first", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { topicId } = await seedTopic(caller, "Comment Order Topic");

    await caller.comments.create({ topicId, content: "First comment" });
    await new Promise((r) => setTimeout(r, 50));
    await caller.comments.create({ topicId, content: "Second comment" });

    const history = await caller.users.getCommentHistory({
      username: TEST_USERS.regular.username,
    });

    expect(history.items.length).toBe(2);
    expect(history.items[0].content).toBe("Second comment");
    expect(history.items[1].content).toBe("First comment");
  });

  it("enforces limit cap of 50", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    await expect(
      caller.users.getCommentHistory({
        username: TEST_USERS.regular.username,
        limit: 51,
      })
    ).rejects.toThrow();
  });

  it("throws NOT_FOUND for unknown username", async () => {
    const caller = await createTestCaller(null);
    await expect(
      caller.users.getCommentHistory({ username: "ghost_user_456" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("supports cursor-based pagination", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { topicId } = await seedTopic(caller, "Comment Paging Topic");

    // Create 3 comments
    for (let i = 0; i < 3; i++) {
      await caller.comments.create({ topicId, content: `Comment ${i}` });
      await new Promise((r) => setTimeout(r, 20));
    }

    const page1 = await caller.users.getCommentHistory({
      username: TEST_USERS.regular.username,
      limit: 2,
    });
    expect(page1.items.length).toBe(2);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await caller.users.getCommentHistory({
      username: TEST_USERS.regular.username,
      limit: 2,
      cursor: page1.nextCursor!,
    });
    expect(page2.items.length).toBe(1);

    // No overlap
    const allIds = [...page1.items, ...page2.items].map((i) => i.id);
    expect(new Set(allIds).size).toBe(3);
  });
});

// ─── users.getCreatedTopics ───────────────────────────────────────────────────

describe("users.getCreatedTopics", () => {
  it("returns topics created by the user in { items } shape", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    await seedTopic(caller, "My Created Topic");

    const result = await caller.users.getCreatedTopics({
      username: TEST_USERS.regular.username,
    });

    expect(result).toHaveProperty("items");
    expect(result.items.length).toBe(1);
    expect(result.items[0]).toMatchObject({
      title: "My Created Topic",
    });
    expect(result.items[0].id).toBeDefined();
    expect(result.items[0].slug).toBeDefined();
    expect(result.items[0]).toHaveProperty("totalRatings");
    expect(result.items[0]).toHaveProperty("createdAt");
    expect(result.items[0]).toHaveProperty("categoryName");
    expect(result.items[0]).toHaveProperty("categorySlug");
  });

  it("returns topics ordered recent-first", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    await seedTopic(caller, "Topic Alpha");
    await new Promise((r) => setTimeout(r, 50));
    await seedTopic(caller, "Topic Bravo");

    const result = await caller.users.getCreatedTopics({
      username: TEST_USERS.regular.username,
    });

    expect(result.items.length).toBe(2);
    expect(result.items[0].title).toBe("Topic Bravo");
    expect(result.items[1].title).toBe("Topic Alpha");
  });

  it("enforces limit cap of 50", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    await expect(
      caller.users.getCreatedTopics({
        username: TEST_USERS.regular.username,
        limit: 51,
      })
    ).rejects.toThrow();
  });

  it("throws NOT_FOUND for unknown username", async () => {
    const caller = await createTestCaller(null);
    await expect(
      caller.users.getCreatedTopics({ username: "ghost_user_789" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("does not include topics created by other users", async () => {
    const regularCaller = await createTestCaller(TEST_USERS.regular.clerkId);
    const adminCaller = await createTestCaller(TEST_USERS.admin.clerkId);

    await seedTopic(regularCaller, "Regular User Topic");
    await seedTopic(adminCaller, "Admin User Topic");

    const result = await regularCaller.users.getCreatedTopics({
      username: TEST_USERS.regular.username,
    });

    expect(result.items.length).toBe(1);
    expect(result.items[0].title).toBe("Regular User Topic");
  });
});

// ─── users.follow ─────────────────────────────────────────────────────────────

describe("users.follow", () => {
  it("creates a follow relationship and updates counts", async () => {
    const regularCaller = await createTestCaller(TEST_USERS.regular.clerkId);
    const admin = await getUserByClerkId(TEST_USERS.admin.clerkId);

    const result = await regularCaller.users.follow({ targetUserId: admin!.id });
    expect(result).toEqual({ success: true });

    // Verify follow row in DB
    const regular = await getUserByClerkId(TEST_USERS.regular.clerkId);
    const [followRow] = await db
      .select()
      .from(follows)
      .where(and(eq(follows.followerId, regular!.id), eq(follows.followingId, admin!.id)))
      .limit(1);
    expect(followRow).toBeDefined();

    // Verify counts
    const updatedRegular = await getUserByClerkId(TEST_USERS.regular.clerkId);
    const updatedAdmin = await getUserByClerkId(TEST_USERS.admin.clerkId);
    expect(updatedRegular!.followingCount).toBe(1);
    expect(updatedAdmin!.followerCount).toBe(1);
  });

  it("rejects self-follow with BAD_REQUEST", async () => {
    // NOTE: PRODUCT.md doesn't explicitly mention a 'no self-follow' error code,
    // but the DB has a CHECK constraint (chk_follows_no_self) and the router
    // throws BAD_REQUEST with "Cannot follow yourself" before hitting the DB.
    const regularCaller = await createTestCaller(TEST_USERS.regular.clerkId);
    const regular = await getUserByClerkId(TEST_USERS.regular.clerkId);

    await expect(
      regularCaller.users.follow({ targetUserId: regular!.id })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Cannot follow yourself",
    });
  });

  it("rejects double-follow (duplicate throws error, not idempotent)", async () => {
    // NOTE: The follow procedure does not use onConflictDoNothing — a duplicate
    // insert will violate the composite PK and throw. This is NOT idempotent.
    const regularCaller = await createTestCaller(TEST_USERS.regular.clerkId);
    const admin = await getUserByClerkId(TEST_USERS.admin.clerkId);

    await regularCaller.users.follow({ targetUserId: admin!.id });

    // Second follow attempt should error (unique constraint violation)
    await expect(
      regularCaller.users.follow({ targetUserId: admin!.id })
    ).rejects.toThrow();
  });

  it("rejects guest caller with UNAUTHORIZED", async () => {
    const guest = await createTestCaller(null);
    const admin = await getUserByClerkId(TEST_USERS.admin.clerkId);

    await expect(
      guest.users.follow({ targetUserId: admin!.id })
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("throws NOT_FOUND for non-existent target user", async () => {
    const regularCaller = await createTestCaller(TEST_USERS.regular.clerkId);
    const fakeId = "00000000-0000-0000-0000-000000000000";

    await expect(
      regularCaller.users.follow({ targetUserId: fakeId })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

// ─── users.unfollow ───────────────────────────────────────────────────────────

describe("users.unfollow", () => {
  it("removes follow relationship and decrements counts", async () => {
    const regularCaller = await createTestCaller(TEST_USERS.regular.clerkId);
    const admin = await getUserByClerkId(TEST_USERS.admin.clerkId);

    // First follow
    await regularCaller.users.follow({ targetUserId: admin!.id });

    // Then unfollow
    const result = await regularCaller.users.unfollow({ targetUserId: admin!.id });
    expect(result).toEqual({ success: true });

    // Verify follow row removed
    const regular = await getUserByClerkId(TEST_USERS.regular.clerkId);
    const followRows = await db
      .select()
      .from(follows)
      .where(and(eq(follows.followerId, regular!.id), eq(follows.followingId, admin!.id)));
    expect(followRows.length).toBe(0);

    // Verify counts back to 0
    const updatedRegular = await getUserByClerkId(TEST_USERS.regular.clerkId);
    const updatedAdmin = await getUserByClerkId(TEST_USERS.admin.clerkId);
    expect(updatedRegular!.followingCount).toBe(0);
    expect(updatedAdmin!.followerCount).toBe(0);
  });

  it("succeeds silently when not following (no error, returns success)", async () => {
    // NOTE: The unfollow handler returns { success: true } regardless of whether
    // a follow existed. It only decrements counts if a row was actually deleted.
    const regularCaller = await createTestCaller(TEST_USERS.regular.clerkId);
    const admin = await getUserByClerkId(TEST_USERS.admin.clerkId);

    // Unfollow without ever following
    const result = await regularCaller.users.unfollow({ targetUserId: admin!.id });
    expect(result).toEqual({ success: true });

    // Counts remain at 0
    const regular = await getUserByClerkId(TEST_USERS.regular.clerkId);
    expect(regular!.followingCount).toBe(0);
  });

  it("rejects guest caller with UNAUTHORIZED", async () => {
    const guest = await createTestCaller(null);
    const admin = await getUserByClerkId(TEST_USERS.admin.clerkId);

    await expect(
      guest.users.unfollow({ targetUserId: admin!.id })
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});

// ─── users.deleteAccount ──────────────────────────────────────────────────────

describe("users.deleteAccount", () => {
  it("deletes user account when user has no topics or ratings", async () => {
    // Use regular user but don't create any topics/ratings
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);

    const result = await caller.users.deleteAccount();
    expect(result).toEqual({ success: true });

    // User row should be deleted
    const deletedUser = await getUserByClerkId(TEST_USERS.regular.clerkId);
    expect(deletedUser).toBeNull();
  });

  it("removes follow relationships when deleting account", async () => {
    const regularCaller = await createTestCaller(TEST_USERS.regular.clerkId);
    const adminCaller = await createTestCaller(TEST_USERS.admin.clerkId);
    const regular = await getUserByClerkId(TEST_USERS.regular.clerkId);
    const admin = await getUserByClerkId(TEST_USERS.admin.clerkId);

    // admin follows regular (so regular has a follower)
    await adminCaller.users.follow({ targetUserId: regular!.id });

    // Delete regular's account
    await regularCaller.users.deleteAccount();

    // All follows involving regular should be gone
    const remainingFollows = await db.select().from(follows);
    expect(remainingFollows.length).toBe(0);
  });

  it("rejects guest caller with UNAUTHORIZED", async () => {
    const guest = await createTestCaller(null);
    await expect(guest.users.deleteAccount()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  // BUG: deleteAccount fails when user has ratings due to CHECK constraint
  // "must_have_rater" on ratings table requiring at least one of userId/guestId
  // to be non-null. The handler sets userId=null which violates this constraint.
  it("fails when user has ratings due to must_have_rater CHECK constraint", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { optionIds } = await seedTopic(caller, "Delete Ratings Bug Topic");

    await caller.ratings.submit({ optionId: optionIds[0], score: 7 });

    // BUG: The handler tries to SET userId = null on ratings, but a DB CHECK
    // constraint requires exactly one of userId/guestId to be non-null.
    // This makes deleteAccount broken for any user who has rated anything.
    await expect(caller.users.deleteAccount()).rejects.toThrow(/must_have_rater/);
  });

  // BUG: deleteAccount fails when user has created topics due to FK constraint.
  // Drizzle schema says onDelete: 'set null' but actual DB uses NO ACTION/RESTRICT.
  it("fails when user has created topics due to FK constraint on topics.creator_id", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    await seedTopic(caller, "Delete Topics Bug Topic");

    // BUG: topics.creator_id FK doesn't CASCADE or SET NULL in the actual DB,
    // so deleting the user row fails with a FK violation.
    await expect(caller.users.deleteAccount()).rejects.toThrow(/topics_creator_id/);
  });

  it("anonymizes comments when user has no topics or ratings", async () => {
    // NOTE: PRODUCT.md says comments should be "shown as '[deleted user]' with text preserved"
    // (Reddit model), but the actual implementation replaces content with '[deleted]'
    // and sets userId to null — destroying the original comment text.
    // BUG: Comment text is destroyed rather than preserved as PRODUCT.md specifies.

    // To test this, we need admin to create the topic (so regular has no topics)
    // and regular to comment without rating (so no ratings constraint issue)
    const adminCaller = await createTestCaller(TEST_USERS.admin.clerkId);
    const regularCaller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { topicId } = await seedTopic(adminCaller, "Admin Topic For Comments");

    await regularCaller.comments.create({ topicId, content: "My hot take" });

    // Now delete regular's account (no ratings, no topics created by them)
    await regularCaller.users.deleteAccount();

    // Comment should be anonymized
    const [comment] = await db
      .select()
      .from(comments)
      .where(eq(comments.topicId, topicId))
      .limit(1);
    expect(comment).toBeDefined();
    expect(comment.content).toBe("[deleted]");
    expect(comment.userId).toBeNull();
  });
});
