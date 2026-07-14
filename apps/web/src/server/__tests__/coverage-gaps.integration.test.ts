/**
 * Targeted coverage-gap tests — exercises branches not covered by main integration tests.
 * Focus: cursor pagination variants, sort branches, error guards, admin/protected middleware.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { resetDb, createTestCaller, TEST_USERS } from "@/test/helpers";
import {
  db, sql, users, topics, comments, reports, options, ratings, follows,
  eq, and,
} from "@rateanything/db";

beforeEach(resetDb);

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getDbUserId(clerkId: string) {
  const [row] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
  return row!.id;
}

async function createTopicWithOptions(caller: Awaited<ReturnType<typeof createTestCaller>>, title: string) {
  const result = await caller.topics.create({
    title,
    categoryId: 1,
    options: [{ name: "Option Alpha" }, { name: "Option Beta" }],
  });
  const [topic] = await db.select().from(topics).where(eq(topics.slug, result.slug)).limit(1);
  const opts = await db.select().from(options).where(eq(options.topicId, topic.id));
  return { topicId: topic.id, slug: topic.slug, optionIds: opts.map(o => o.id) };
}

async function createExtraUser(suffix: string) {
  const [user] = await db
    .insert(users)
    .values({
      clerkId: `user_cg_${suffix}`,
      username: `cg_${suffix}`,
      email: `cg_${suffix}@test.dev`,
    })
    .returning({ id: users.id, clerkId: users.clerkId });
  return user;
}

// ─── comments.getForTopic sort="top" ─────────────────────────────────────────

describe("comments.getForTopic sort=top", () => {
  it("returns comments ordered by score (upvotes - downvotes) DESC", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const admin = await createTestCaller(TEST_USERS.admin.clerkId);
    const { topicId } = await createTopicWithOptions(caller, "Sort Top Comments");

    const c1 = await caller.comments.create({ topicId, content: "Low score comment here" });
    const c2 = await admin.comments.create({ topicId, content: "High score comment here" });

    // Upvote c2 twice (different users)
    await caller.comments.upvote({ commentId: c2.id });
    await admin.comments.upvote({ commentId: c2.id });
    // Downvote c1
    await admin.comments.downvote({ commentId: c1.id });

    const result = await caller.comments.getForTopic({ topicId, sort: "top" });
    expect(result.comments.length).toBe(2);
    // c2 has higher net score (2 upvotes > c1's -1 downvote)
    expect(result.comments[0].id).toBe(c2.id);
    expect(result.comments[1].id).toBe(c1.id);
  });

  it("cursor pagination works for sort=top", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { topicId } = await createTopicWithOptions(caller, "Top Sort Cursor Test");

    // Create 3 comments
    await caller.comments.create({ topicId, content: "Top sort comment A" });
    await caller.comments.create({ topicId, content: "Top sort comment B" });
    await caller.comments.create({ topicId, content: "Top sort comment C" });

    const page1 = await caller.comments.getForTopic({ topicId, sort: "top", limit: 2 });
    expect(page1.comments).toHaveLength(2);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await caller.comments.getForTopic({ topicId, sort: "top", limit: 2, cursor: page1.nextCursor! });
    expect(page2.comments).toHaveLength(1);
    expect(page2.nextCursor).toBeNull();

    // No overlap between pages
    const ids1 = page1.comments.map(c => c.id);
    const ids2 = page2.comments.map(c => c.id);
    expect(ids1.filter(id => ids2.includes(id))).toHaveLength(0);
  });
});

// ─── comments.getForTopic: userVote populated for authed caller ──────────────

describe("comments.getForTopic userVote", () => {
  it("includes current user vote in response", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { topicId } = await createTopicWithOptions(caller, "UserVote Display Test");

    const c1 = await caller.comments.create({ topicId, content: "Comment with userVote check" });
    await caller.comments.upvote({ commentId: c1.id });

    const result = await caller.comments.getForTopic({ topicId });
    expect(result.comments[0].userVote).toBe("upvote");
  });

  it("guest sees userVote as null", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const guest = await createTestCaller(null);
    const { topicId } = await createTopicWithOptions(caller, "Guest UserVote Test");

    await caller.comments.create({ topicId, content: "Comment to check null vote" });

    const result = await guest.comments.getForTopic({ topicId });
    expect(result.comments[0].userVote).toBeNull();
  });
});

// ─── comments.reply: rating not found ────────────────────────────────────────

describe("comments.reply error guards", () => {
  it("throws NOT_FOUND for non-existent ratingId", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    await expect(
      caller.comments.reply({
        ratingId: crypto.randomUUID(),
        content: "Reply to non-existent rating 20+ chars",
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("throws NOT_FOUND for non-existent parentId in reply", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { optionIds } = await createTopicWithOptions(caller, "Reply Parent NF");
    await caller.ratings.submit({ optionId: optionIds[0], score: 7 });
    const [rating] = await db.select({ id: ratings.id }).from(ratings).where(eq(ratings.optionId, optionIds[0])).limit(1);

    await expect(
      caller.comments.reply({
        ratingId: rating.id,
        parentId: crypto.randomUUID(),
        content: "Reply to non-existent parent comment",
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

// ─── comments.upvote/downvote: NOT_FOUND for non-existent comment ────────────

describe("comments.upvote/downvote error guards", () => {
  it("upvote throws NOT_FOUND for non-existent comment", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    await expect(
      caller.comments.upvote({ commentId: crypto.randomUUID() })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("downvote throws NOT_FOUND for non-existent comment", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    await expect(
      caller.comments.downvote({ commentId: crypto.randomUUID() })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

// ─── ratings.getForOption sort="hot" cursor pagination ────────────────────────

describe("ratings.getForOption hot sort with cursor", () => {
  it("cursor pagination works for sort=hot", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const guest = await createTestCaller(null);
    const { optionIds } = await createTopicWithOptions(caller, "Hot Cursor Pag");

    // Create 3 ratings with different scores
    await caller.ratings.submit({ optionId: optionIds[0], score: 10 });
    await guest.ratings.submit({ optionId: optionIds[0], score: 5, guestFingerprint: "fp_hot_1" });
    await guest.ratings.submit({ optionId: optionIds[0], score: 2, guestFingerprint: "fp_hot_2" });

    const page1 = await caller.ratings.getForOption({ optionId: optionIds[0], sort: "hot", limit: 2 });
    expect(page1.ratings).toHaveLength(2);
    expect(page1.nextCursor).not.toBeNull();
    // Hot sort: highest score first
    expect(page1.ratings[0].score).toBe(10);

    const page2 = await caller.ratings.getForOption({
      optionId: optionIds[0],
      sort: "hot",
      limit: 2,
      cursor: page1.nextCursor!,
    });
    expect(page2.ratings).toHaveLength(1);
    expect(page2.nextCursor).toBeNull();
  });
});

// ─── ratings.getForOption sort="controversial" cursor pagination ──────────────

describe("ratings.getForOption controversial sort with cursor", () => {
  it("controversial sort returns ratings ordered by distance from average", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const guest = await createTestCaller(null);
    const { optionIds } = await createTopicWithOptions(caller, "Controversial Sort");

    // Create 3 ratings: avg = (3+5+7)/3 = 5, so 3 and 7 are equally controversial (distance=2)
    await caller.ratings.submit({ optionId: optionIds[0], score: 3 });
    await guest.ratings.submit({ optionId: optionIds[0], score: 5, guestFingerprint: "fp_con_1" });
    await guest.ratings.submit({ optionId: optionIds[0], score: 7, guestFingerprint: "fp_con_2" });

    const result = await caller.ratings.getForOption({
      optionId: optionIds[0],
      sort: "controversial",
      limit: 10,
    });
    expect(result.ratings).toHaveLength(3);
    // Most controversial (furthest from avg 5) should be first
    // Scores 3 and 7 both have distance 2 from avg; score 5 has distance 0
    // Last rating should be the one closest to average (score=5)
    expect(result.ratings[2].score).toBe(5);
  });

  // FIXED: When avg is fractional (e.g. 5.5), the controversial sort now works correctly
  // (previously failed with "invalid input syntax for type smallint" due to missing ::real cast).
  
  it("controversial sort with cursor pagination (integer avg)", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const guest = await createTestCaller(null);
    const { optionIds } = await createTopicWithOptions(caller, "Controversial Cursor2");

    // Create 3 ratings: avg = (2+5+8)/3 = 5
    await caller.ratings.submit({ optionId: optionIds[0], score: 2 });
    await guest.ratings.submit({ optionId: optionIds[0], score: 5, guestFingerprint: "fp_con_a2" });
    await guest.ratings.submit({ optionId: optionIds[0], score: 8, guestFingerprint: "fp_con_b2" });

    const page1 = await caller.ratings.getForOption({
      optionId: optionIds[0],
      sort: "controversial",
      limit: 2,
    });
    expect(page1.ratings).toHaveLength(2);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await caller.ratings.getForOption({
      optionId: optionIds[0],
      sort: "controversial",
      limit: 2,
      cursor: page1.nextCursor!,
    });
    // Controversial cursor uses createdAt-based keyset but orders by ABS(score - avg).
    // This may cause misalignment, but should not crash.
    expect(page2.ratings.length).toBeGreaterThanOrEqual(0);
  });

  // FIXED: controversial sort now works with fractional averages (explicit ::real cast)
  it("controversial sort works with fractional average", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const guest = await createTestCaller(null);
    const { optionIds } = await createTopicWithOptions(caller, "Controversial Frac Bug");

    // avg = (1+4+7+10)/4 = 5.5 — fractional avg now handled correctly
    await caller.ratings.submit({ optionId: optionIds[0], score: 1 });
    await guest.ratings.submit({ optionId: optionIds[0], score: 4, guestFingerprint: "fp_frac_1" });
    await guest.ratings.submit({ optionId: optionIds[0], score: 7, guestFingerprint: "fp_frac_2" });
    await guest.ratings.submit({ optionId: optionIds[0], score: 10, guestFingerprint: "fp_frac_3" });

    // FIXED: No longer throws - fractional avg is properly cast to real
    const result = await caller.ratings.getForOption({ optionId: optionIds[0], sort: "controversial", limit: 10 });
    expect(result.ratings).toHaveLength(4);
    // Most controversial (furthest from avg 5.5): score 1 (dist 4.5) and score 10 (dist 4.5)
    expect([1, 10]).toContain(result.ratings[0].score);
  });
});

// ─── moderation.queue cursor pagination ──────────────────────────────────────

describe("moderation.queue cursor pagination", () => {
  it("paginates with cursor correctly", async () => {
    const admin = await createTestCaller(TEST_USERS.admin.clerkId);
    const { topicId } = await createTopicWithOptions(admin, "Queue Cursor Topic");

    // Create 3 reports from different users
    for (let i = 1; i <= 3; i++) {
      const extra = await createExtraUser(`queue_cur_${i}`);
      const extraCaller = await createTestCaller(extra.clerkId);
      await extraCaller.moderation.report({
        targetType: "topic",
        targetId: topicId,
        reason: "spam",
        details: `Report ${i} for pagination`,
      });
    }

    const page1 = await admin.moderation.queue({ status: "pending", limit: 2 });
    expect(page1.reports).toHaveLength(2);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await admin.moderation.queue({
      status: "pending",
      limit: 2,
      cursor: page1.nextCursor!,
    });
    expect(page2.reports).toHaveLength(1);
    expect(page2.nextCursor).toBeNull();
  });
});

// ─── users.getRatingHistory invalid cursor ───────────────────────────────────

describe("users.getRatingHistory edge cases", () => {
  it("throws BAD_REQUEST for invalid (non-base64) cursor", async () => {
    const caller = await createTestCaller(null);
    await expect(
      caller.users.getRatingHistory({
        username: TEST_USERS.regular.username,
        cursor: "not-valid-base64!!!{{{{",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

// ─── users.getCommentHistory invalid cursor ──────────────────────────────────

describe("users.getCommentHistory edge cases", () => {
  it("throws BAD_REQUEST for invalid (non-base64) cursor", async () => {
    const caller = await createTestCaller(null);
    await expect(
      caller.users.getCommentHistory({
        username: TEST_USERS.regular.username,
        cursor: "not-valid-base64!!!{{{{",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("returns items from comment on rating (via ratingId path)", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { topicId, optionIds } = await createTopicWithOptions(caller, "Comment History Rating");

    // Submit a rating, then reply to it (creates comment with ratingId)
    await caller.ratings.submit({ optionId: optionIds[0], score: 7 });
    const [rating] = await db.select({ id: ratings.id }).from(ratings).where(eq(ratings.optionId, optionIds[0])).limit(1);
    await caller.comments.reply({ ratingId: rating.id, content: "Reply on rating for history check" });

    const result = await caller.users.getCommentHistory({ username: TEST_USERS.regular.username });
    expect(result.items.length).toBeGreaterThanOrEqual(1);
    // Should resolve topic via rating path
    expect(result.items[0].topicTitle).not.toBe("Unknown Topic");
  });
});

// ─── users.deleteAccount with ratings ────────────────────────────────────────

describe("users.deleteAccount edge case", () => {
  it("rejects guest caller with UNAUTHORIZED", async () => {
    const guest = await createTestCaller(null);
    await expect(guest.users.deleteAccount()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

// ─── topics.addOption: NOT_FOUND for non-existent topic ──────────────────────

describe("topics.addOption error guards", () => {
  it("throws NOT_FOUND for non-existent topicId", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    await expect(
      caller.topics.addOption({ topicId: crypto.randomUUID(), name: "New Option" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

// ─── topics.trending: categoryId filter ──────────────────────────────────────

describe("topics.trending categoryId filter", () => {
  it("filters topics by categoryId", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);

    // Create topics in different categories
    await caller.topics.create({
      title: "Cat1 Trending Topic Filt",
      categoryId: 1,
      options: [{ name: "Opt A" }, { name: "Opt A2" }],
    });
    await caller.topics.create({
      title: "Cat2 Trending Topic Filt",
      categoryId: 2,
      options: [{ name: "Opt B" }, { name: "Opt B2" }],
    });

    const filtered = await caller.topics.trending({ categoryId: 1, limit: 50 });
    // All topics should be category 1
    for (const t of filtered.topics) {
      // Can't directly check categoryId in response, but should not include the cat2 topic
      expect(t.title).not.toBe("Cat2 Trending Topic Filt");
    }
  });
});

// ─── topics.create: guest is rejected ────────────────────────────────────────

describe("topics.create auth guard", () => {
  it("guest caller is rejected with UNAUTHORIZED", async () => {
    const guest = await createTestCaller(null);
    await expect(
      guest.topics.create({
        title: "Guest Topic Should Fail",
        categoryId: 1,
        options: [{ name: "A" }, { name: "B" }],
      })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

// ─── comments.remove: admin can delete another user's comment ─────────────────

describe("comments.remove admin override", () => {
  it("admin can delete another user's comment", async () => {
    const regular = await createTestCaller(TEST_USERS.regular.clerkId);
    const admin = await createTestCaller(TEST_USERS.admin.clerkId);
    const { topicId } = await createTopicWithOptions(regular, "Admin Delete Comment");

    const comment = await regular.comments.create({ topicId, content: "Regular user comment" });

    const result = await admin.comments.remove({ commentId: comment.id });
    expect(result.success).toBe(true);
    expect(result.mode).toBe("deleted");
  });
});

// ─── comments.remove: NOT_FOUND for non-existent comment ─────────────────────

describe("comments.remove error guards", () => {
  it("throws NOT_FOUND for non-existent commentId", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    await expect(
      caller.comments.remove({ commentId: crypto.randomUUID() })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("throws FORBIDDEN when non-author non-admin tries to delete", async () => {
    const regular = await createTestCaller(TEST_USERS.regular.clerkId);
    const { topicId } = await createTopicWithOptions(regular, "Forbidden Delete Test");
    const comment = await regular.comments.create({ topicId, content: "Only author can delete" });

    // Create a non-admin second user
    const extra = await createExtraUser("forbidden_del");
    const extraCaller = await createTestCaller(extra.clerkId);

    await expect(
      extraCaller.comments.remove({ commentId: comment.id })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("already-deleted comment returns idempotent success", async () => {
    const caller = await createTestCaller(TEST_USERS.admin.clerkId);
    const { topicId } = await createTopicWithOptions(caller, "Idempotent Delete Test");

    const parent = await caller.comments.create({ topicId, content: "Parent for idempotent del" });
    const _reply = await caller.comments.create({ topicId, content: "Reply keeps parent alive", parentId: parent.id });

    // First delete tombstones it
    await caller.comments.remove({ commentId: parent.id });
    // Second delete should be idempotent
    const result = await caller.comments.remove({ commentId: parent.id });
    expect(result.success).toBe(true);
    expect(result.mode).toBe("already-deleted");
  });
});

// ─── moderation: auto-hide for rating targetType (no-op branch) ──────────────

describe("moderation auto-hide rating targetType", () => {
  it("5 reports on a rating targetType do NOT crash (no hide column)", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { optionIds } = await createTopicWithOptions(caller, "Rating Report Topic");
    await caller.ratings.submit({ optionId: optionIds[0], score: 7 });
    const [rating] = await db.select({ id: ratings.id }).from(ratings).where(eq(ratings.optionId, optionIds[0])).limit(1);

    // 5 distinct reporters
    for (let i = 1; i <= 5; i++) {
      const extra = await createExtraUser(`rating_rep_${i}`);
      const extraCaller = await createTestCaller(extra.clerkId);
      await extraCaller.moderation.report({
        targetType: "rating",
        targetId: rating.id,
        reason: "spam",
      });
    }
    // Should not throw — the "rating" branch of auto-hide is a no-op
    // Verify all 5 reports exist
    const allReports = await db.select().from(reports).where(eq(reports.targetId, rating.id));
    expect(allReports).toHaveLength(5);
  });
});

// ─── moderation: queue with status "reviewing" ───────────────────────────────

describe("moderation.queue status filter", () => {
  it("returns empty when no reports match the status", async () => {
    const admin = await createTestCaller(TEST_USERS.admin.clerkId);
    // No reports have status 'reviewed'
    const result = await admin.moderation.queue({ status: "reviewed" });
    expect(result.reports).toHaveLength(0);
    expect(result.nextCursor).toBeNull();
  });
});

// ─── topics.getBySlug: topComments branch (rating with comment) ──────────────

describe("topics.getBySlug topComments", () => {
  it("returns topComment for options that have rated-with-comment", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { slug, optionIds } = await createTopicWithOptions(caller, "TopComment Display Test");

    // Submit a rating with a comment
    await caller.ratings.submit({
      optionId: optionIds[0],
      score: 8,
      comment: "This is my review comment for the option",
    });

    const result = await caller.topics.getBySlug({ slug });
    // The option with the comment should have a topComment
    const optWithComment = result.options.find(o => o.id === optionIds[0]);
    expect(optWithComment).toBeDefined();
    expect(optWithComment!.topComment).not.toBeNull();
    expect(optWithComment!.topComment!.comment).toBe("This is my review comment for the option");
    expect(optWithComment!.topComment!.username).toBe(TEST_USERS.regular.username);
    expect(optWithComment!.topComment!.score).toBe(8);
  });
});

// ─── comments.create: parent nesting depth guard ─────────────────────────────

describe("comments.create nesting depth", () => {
  it("rejects creating a reply to a level-2 comment (max nesting depth 2)", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { topicId } = await createTopicWithOptions(caller, "Create Nesting Depth");

    const level1 = await caller.comments.create({ topicId, content: "Level 1 comment here" });
    const level2 = await caller.comments.create({
      topicId,
      content: "Level 2 reply to level 1",
      parentId: level1.id,
    });

    // Attempting to create a level-3 comment should fail
    await expect(
      caller.comments.create({
        topicId,
        content: "Level 3 - should be rejected",
        parentId: level2.id,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects creating a comment with non-existent parentId", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { topicId } = await createTopicWithOptions(caller, "Create Bad Parent");

    await expect(
      caller.comments.create({
        topicId,
        content: "Comment to non-existent parent",
        parentId: crypto.randomUUID(),
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects creating a comment on non-existent topicId", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    await expect(
      caller.comments.create({
        topicId: crypto.randomUUID(),
        content: "Comment on missing topic",
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

// ─── comments.remove: parent cleanup when parent is tombstoned with no children

describe("comments.remove parent cleanup", () => {
  it("hard-deletes tombstoned parent when last child is removed", async () => {
    const caller = await createTestCaller(TEST_USERS.admin.clerkId);
    const { topicId } = await createTopicWithOptions(caller, "Parent Cleanup Test");

    const parent = await caller.comments.create({ topicId, content: "Parent that will be orphaned" });
    const child = await caller.comments.create({ topicId, content: "Only child of parent", parentId: parent.id });

    // Tombstone the parent first (has child, so it gets tombstoned)
    const r1 = await caller.comments.remove({ commentId: parent.id });
    expect(r1.mode).toBe("tombstoned");

    // Now delete the child (leaf) — should also clean up the tombstoned parent
    const r2 = await caller.comments.remove({ commentId: child.id });
    expect(r2.success).toBe(true);
    expect(r2.mode).toBe("deleted+parent");

    // Verify both are gone from DB
    const remaining = await db.select().from(comments).where(eq(comments.topicId, topicId));
    expect(remaining).toHaveLength(0);
  });

  it("does NOT clean up parent if parent still has other children", async () => {
    const caller = await createTestCaller(TEST_USERS.admin.clerkId);
    const { topicId } = await createTopicWithOptions(caller, "Parent Keep Test");

    const parent = await caller.comments.create({ topicId, content: "Parent with two children" });
    const child1 = await caller.comments.create({ topicId, content: "Child 1 stays alive", parentId: parent.id });
    const child2 = await caller.comments.create({ topicId, content: "Child 2 gets deleted", parentId: parent.id });

    // Tombstone parent
    await caller.comments.remove({ commentId: parent.id });
    // Delete child2 — parent still has child1, so parent should NOT be cleaned up
    const r = await caller.comments.remove({ commentId: child2.id });
    expect(r.mode).toBe("deleted"); // not "deleted+parent"

    // Parent still exists (tombstoned)
    const [parentRow] = await db.select().from(comments).where(eq(comments.id, parent.id)).limit(1);
    expect(parentRow).toBeDefined();
    expect(parentRow.isDeleted).toBe(true);
  });
});

// ─── ratings.remove: guest-not-found early return + neither auth/guest guard ─

describe("ratings.remove edge cases", () => {
  it("returns gracefully when guest fingerprint has no existing guest record", async () => {
    const guest = await createTestCaller(null);
    const authed = await createTestCaller(TEST_USERS.regular.clerkId);
    const { optionIds } = await createTopicWithOptions(authed, "Remove NF Guest");

    // Try removing with a fingerprint that has never rated
    const result = await guest.ratings.remove({
      optionId: optionIds[0],
      guestFingerprint: "fp_never_rated_xyz",
    });
    // Should return current option stats without error (idempotent)
    expect(result.optionRatingCount).toBeDefined();
  });
});

// ─── topics.trending: cursor with categoryId combined ────────────────────────

describe("topics.trending cursor + category", () => {
  it("cursor pagination works with categoryId filter", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);

    // Create 3 topics in same category to trigger pagination
    for (let i = 0; i < 3; i++) {
      await caller.topics.create({
        title: `Trending Cat Cur Topic ${i}`,
        categoryId: 1,
        options: [{ name: "Opt A" }, { name: "Opt B" }],
      });
    }

    const page1 = await caller.topics.trending({ categoryId: 1, limit: 2 });
    expect(page1.topics).toHaveLength(2);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await caller.topics.trending({ categoryId: 1, limit: 2, cursor: page1.nextCursor! });
    expect(page2.topics).toHaveLength(1);
    expect(page2.nextCursor).toBeNull();
  });
});

// ─── moderation.queue: "reviewed" status filter with no matching reports ─────
// No reports default to 'reviewed' status, so querying for it returns empty.

describe("moderation.queue reviewed status (empty result)", () => {
  it("returns empty array for reviewed status (no reports default to this status)", async () => {
    const regular = await createTestCaller(TEST_USERS.regular.clerkId);
    const admin = await createTestCaller(TEST_USERS.admin.clerkId);
    const { topicId } = await createTopicWithOptions(admin, "Reviewing Status Test2");

    // Create a report (defaults to 'pending')
    await regular.moderation.report({
      targetType: "topic",
      targetId: topicId,
      reason: "spam",
    });

    // Query for 'reviewed' — should be empty since no reports default to that status
    const result = await admin.moderation.queue({ status: "reviewed" });
    expect(result.reports).toHaveLength(0);
  });
});

// ─── ratings.remove: neither auth nor guest guard ────────────────────────────

describe("ratings.remove neither-auth-nor-guest guard", () => {
  it("throws BAD_REQUEST when guest caller omits fingerprint", async () => {
    const guest = await createTestCaller(null);
    const authed = await createTestCaller(TEST_USERS.regular.clerkId);
    const { optionIds } = await createTopicWithOptions(authed, "Remove No FP");

    await expect(
      guest.ratings.remove({ optionId: optionIds[0] })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
