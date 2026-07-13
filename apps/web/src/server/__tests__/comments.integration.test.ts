/**
 * Integration tests for the comments router.
 * Covers: create, reply, upvote, downvote, remove, getForTopic
 */
import { describe, it, expect, beforeEach } from "vitest";
import { resetDb, createTestCaller, TEST_USERS } from "@/test/helpers";
import {
  db, sql, comments, commentVotes, topics, options, ratings, users,
  eq, and,
} from "@rateanything/db";

beforeEach(resetDb);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Creates a topic with 2 options, returns topicId + optionIds */
async function createTopicWithOptions(
  caller: Awaited<ReturnType<typeof createTestCaller>>,
  title: string,
  categoryId = 1
) {
  const { id: topicId } = await caller.topics.create({
    title,
    categoryId,
    options: [{ name: `${title} Opt A` }, { name: `${title} Opt B` }],
  });
  const createdOptions = await db
    .select({ id: options.id })
    .from(options)
    .where(eq(options.topicId, topicId))
    .orderBy(options.sortOrder);
  return { topicId, optionIds: createdOptions.map((o) => o.id) };
}

/** Create a rating on an option (needed for `reply` which attaches to a rating) */
async function createRating(
  caller: Awaited<ReturnType<typeof createTestCaller>>,
  optionId: string,
  score = 7
) {
  await caller.ratings.submit({ optionId, score });
  const [rating] = await db
    .select({ id: ratings.id })
    .from(ratings)
    .where(eq(ratings.optionId, optionId))
    .limit(1);
  return rating.id;
}

/** Get comment row directly from DB */
async function getCommentRow(commentId: string) {
  const [row] = await db
    .select()
    .from(comments)
    .where(eq(comments.id, commentId))
    .limit(1);
  return row ?? null;
}

/** Get topic row from DB */
async function getTopicRow(topicId: string) {
  const [row] = await db
    .select({
      lastActivity: topics.lastActivity,
      trendingScore: topics.trendingScore,
    })
    .from(topics)
    .where(eq(topics.id, topicId))
    .limit(1);
  return row;
}

/** Count comment_votes for a comment */
async function getVoteRows(commentId: string) {
  const rows = await db
    .select()
    .from(commentVotes)
    .where(eq(commentVotes.commentId, commentId));
  return rows;
}

// ─── comments.create ─────────────────────────────────────────────────────────

describe("comments.create", () => {
  it("creates a valid comment persisted with correct author + topic", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { topicId } = await createTopicWithOptions(caller, "Create Comment Test");

    const content = "This is a valid comment body for testing purposes.";
    const result = await caller.comments.create({ topicId, content });

    expect(result.id).toBeDefined();
    expect(result.createdAt).toBeDefined();

    const row = await getCommentRow(result.id);
    expect(row).not.toBeNull();
    expect(row!.content).toBe(content);
    expect(row!.topicId).toBe(topicId);
    expect(row!.parentId).toBeNull();
    expect(row!.upvotes).toBe(0);
    expect(row!.downvotes).toBe(0);
    expect(row!.isDeleted).toBe(false);

    // Verify author
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, TEST_USERS.regular.clerkId))
      .limit(1);
    expect(row!.userId).toBe(user.id);
  });

  // NOTE: PRODUCT.md §4.4 recommends 20 characters minimum for comments.
  // However, `comments.create` uses `.min(1)` in the Zod schema — only `reply`
  // enforces `.min(20)`. This test documents the actual behavior (min 1 char).
  it("allows content as short as 1 character (min 1 — diverges from PRODUCT.md min 20)", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { topicId } = await createTopicWithOptions(caller, "Min Length Test");

    // 1-char content passes (actual min enforced by Zod is 1)
    const result = await caller.comments.create({ topicId, content: "X" });
    expect(result.id).toBeDefined();
  });

  it("rejects empty content (0 chars)", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { topicId } = await createTopicWithOptions(caller, "Empty Content Test");

    await expect(
      caller.comments.create({ topicId, content: "" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("allows content of exactly 500 characters (max boundary)", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { topicId } = await createTopicWithOptions(caller, "Max 500 Test");

    const content500 = "A".repeat(500);
    const result = await caller.comments.create({ topicId, content: content500 });
    expect(result.id).toBeDefined();

    const row = await getCommentRow(result.id);
    expect(row!.content).toHaveLength(500);
  });

  it("rejects content of 501 characters (exceeds max 500)", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { topicId } = await createTopicWithOptions(caller, "Over Max Test");

    const content501 = "B".repeat(501);
    await expect(
      caller.comments.create({ topicId, content: content501 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("requires auth — guest caller gets UNAUTHORIZED", async () => {
    const authed = await createTestCaller(TEST_USERS.regular.clerkId);
    const { topicId } = await createTopicWithOptions(authed, "Auth Test");

    const guest = await createTestCaller(null);
    await expect(
      guest.comments.create({ topicId, content: "Guest trying to comment" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("updates topic lastActivity and trendingScore on comment", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { topicId } = await createTopicWithOptions(caller, "Trending Update Test");

    const before = await getTopicRow(topicId);
    const beforeLastActivity = before.lastActivity;

    // Small delay to ensure timestamp difference
    await new Promise((r) => setTimeout(r, 50));

    await caller.comments.create({ topicId, content: "This should update trending" });

    const after = await getTopicRow(topicId);
    // lastActivity should be updated (>= before)
    expect(new Date(after.lastActivity!).getTime()).toBeGreaterThanOrEqual(
      new Date(beforeLastActivity!).getTime()
    );
    // trendingScore should be recalculated (formula: total_ratings / 2^1.5)
    expect(after.trendingScore).toBeDefined();
  });
});

// ─── comments.reply ──────────────────────────────────────────────────────────

describe("comments.reply", () => {
  it("creates a nested reply attached to a rating", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { topicId, optionIds } = await createTopicWithOptions(caller, "Reply Test");
    const ratingId = await createRating(caller, optionIds[0]);

    // Create a top-level comment on the rating
    const topLevel = await caller.comments.reply({
      ratingId,
      content: "Top-level reply on a rating (20+ chars ok)",
    });

    // Create a nested reply to the top-level comment
    const nested = await caller.comments.reply({
      ratingId,
      parentId: topLevel.id,
      content: "This is a nested reply to the top-level comment",
    });

    expect(nested.id).toBeDefined();
    const row = await getCommentRow(nested.id);
    expect(row!.parentId).toBe(topLevel.id);
    expect(row!.ratingId).toBe(ratingId);
  });

  it("rejects replying to a level-2 comment (max nesting depth 2 levels)", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { topicId, optionIds } = await createTopicWithOptions(caller, "Nesting Cap Test");
    const ratingId = await createRating(caller, optionIds[0]);

    const level1 = await caller.comments.reply({
      ratingId,
      content: "Level 1 comment — at least twenty characters here",
    });
    const level2 = await caller.comments.reply({
      ratingId,
      parentId: level1.id,
      content: "Level 2 reply — enough characters for min",
    });

    // Attempting level 3 should fail
    await expect(
      caller.comments.reply({
        ratingId,
        parentId: level2.id,
        content: "Level 3 attempt — should be rejected by nesting cap",
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("nesting depth"),
    });
  });

  it("enforces minimum 20 characters on reply content", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { optionIds } = await createTopicWithOptions(caller, "Reply MinLen Test");
    const ratingId = await createRating(caller, optionIds[0]);

    // 19 chars should fail
    await expect(
      caller.comments.reply({ ratingId, content: "A".repeat(19) })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    // 20 chars should succeed
    const result = await caller.comments.reply({ ratingId, content: "B".repeat(20) });
    expect(result.id).toBeDefined();
  });

  it("enforces maximum 500 characters on reply content", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { optionIds } = await createTopicWithOptions(caller, "Reply MaxLen Test");
    const ratingId = await createRating(caller, optionIds[0]);

    // 501 chars should fail
    await expect(
      caller.comments.reply({ ratingId, content: "C".repeat(501) })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    // 500 chars should succeed
    const result = await caller.comments.reply({ ratingId, content: "D".repeat(500) });
    expect(result.id).toBeDefined();
  });
});

// ─── comments.upvote ─────────────────────────────────────────────────────────

describe("comments.upvote", () => {
  async function setupComment() {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { topicId } = await createTopicWithOptions(caller, `Upvote ${Date.now()}`);
    const { id: commentId } = await caller.comments.create({
      topicId,
      content: "Comment to test upvoting behavior",
    });
    return { caller, commentId };
  }

  it("new upvote: +1/0/+1 counters", async () => {
    const { caller, commentId } = await setupComment();

    const res = await caller.comments.upvote({ commentId });
    expect(res.upvotes).toBe(1);
    expect(res.downvotes).toBe(0);
    expect(res.score).toBe(1);
    expect(res.userVote).toBe("upvote");

    // Verify DB
    const row = await getCommentRow(commentId);
    expect(row!.upvotes).toBe(1);
    expect(row!.downvotes).toBe(0);
    expect(row!.score).toBe(1);

    // Verify vote row exists
    const votes = await getVoteRows(commentId);
    expect(votes).toHaveLength(1);
    expect(votes[0].vote).toBe("upvote");
  });

  it("upvote again = toggle off (row removed, 0/0/0)", async () => {
    const { caller, commentId } = await setupComment();

    await caller.comments.upvote({ commentId });
    const res = await caller.comments.upvote({ commentId });

    expect(res.upvotes).toBe(0);
    expect(res.downvotes).toBe(0);
    expect(res.score).toBe(0);
    expect(res.userVote).toBeNull();

    // Vote row should be removed
    const votes = await getVoteRows(commentId);
    expect(votes).toHaveLength(0);

    // DB counters
    const row = await getCommentRow(commentId);
    expect(row!.upvotes).toBe(0);
    expect(row!.downvotes).toBe(0);
    expect(row!.score).toBe(0);
  });

  it("switch from downvote to upvote: +1/-1→0, counters 1/0/+1", async () => {
    const { caller, commentId } = await setupComment();

    await caller.comments.downvote({ commentId }); // 0/1/-1
    const res = await caller.comments.upvote({ commentId }); // switch: 1/0/+1

    expect(res.upvotes).toBe(1);
    expect(res.downvotes).toBe(0);
    expect(res.score).toBe(1);
    expect(res.userVote).toBe("upvote");

    // DB
    const row = await getCommentRow(commentId);
    expect(row!.upvotes).toBe(1);
    expect(row!.downvotes).toBe(0);
    expect(row!.score).toBe(1);

    // Vote row should be 'upvote'
    const votes = await getVoteRows(commentId);
    expect(votes).toHaveLength(1);
    expect(votes[0].vote).toBe("upvote");
  });
});

// ─── comments.downvote ───────────────────────────────────────────────────────

describe("comments.downvote", () => {
  async function setupComment() {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { topicId } = await createTopicWithOptions(caller, `Downvote ${Date.now()}`);
    const { id: commentId } = await caller.comments.create({
      topicId,
      content: "Comment to test downvoting behavior",
    });
    return { caller, commentId };
  }

  it("new downvote: 0/+1/-1 counters", async () => {
    const { caller, commentId } = await setupComment();

    const res = await caller.comments.downvote({ commentId });
    expect(res.upvotes).toBe(0);
    expect(res.downvotes).toBe(1);
    expect(res.score).toBe(-1);
    expect(res.userVote).toBe("downvote");

    // Verify DB
    const row = await getCommentRow(commentId);
    expect(row!.upvotes).toBe(0);
    expect(row!.downvotes).toBe(1);
    expect(row!.score).toBe(-1);

    // Verify vote row exists
    const votes = await getVoteRows(commentId);
    expect(votes).toHaveLength(1);
    expect(votes[0].vote).toBe("downvote");
  });

  it("downvote again = toggle off (row removed, 0/0/0)", async () => {
    const { caller, commentId } = await setupComment();

    await caller.comments.downvote({ commentId });
    const res = await caller.comments.downvote({ commentId });

    expect(res.upvotes).toBe(0);
    expect(res.downvotes).toBe(0);
    expect(res.score).toBe(0);
    expect(res.userVote).toBeNull();

    // Vote row should be removed
    const votes = await getVoteRows(commentId);
    expect(votes).toHaveLength(0);

    // DB counters
    const row = await getCommentRow(commentId);
    expect(row!.upvotes).toBe(0);
    expect(row!.downvotes).toBe(0);
    expect(row!.score).toBe(0);
  });

  it("switch from upvote to downvote: counters 0/1/-1", async () => {
    const { caller, commentId } = await setupComment();

    await caller.comments.upvote({ commentId }); // 1/0/+1
    const res = await caller.comments.downvote({ commentId }); // switch: 0/1/-1

    expect(res.upvotes).toBe(0);
    expect(res.downvotes).toBe(1);
    expect(res.score).toBe(-1);
    expect(res.userVote).toBe("downvote");

    // DB
    const row = await getCommentRow(commentId);
    expect(row!.upvotes).toBe(0);
    expect(row!.downvotes).toBe(1);
    expect(row!.score).toBe(-1);

    // Vote row should be 'downvote'
    const votes = await getVoteRows(commentId);
    expect(votes).toHaveLength(1);
    expect(votes[0].vote).toBe("downvote");
  });
});

// ─── comments.remove ─────────────────────────────────────────────────────────

describe("comments.remove", () => {
  it("hard-deletes a LEAF comment (row + votes gone)", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { topicId } = await createTopicWithOptions(caller, "Remove Leaf Test");

    const { id: commentId } = await caller.comments.create({
      topicId,
      content: "Leaf comment to be deleted entirely",
    });
    // Add a vote so we can verify cascade
    await caller.comments.upvote({ commentId });

    const res = await caller.comments.remove({ commentId });
    expect(res.success).toBe(true);
    expect(res.mode).toBe("deleted");

    // Row should be gone
    const row = await getCommentRow(commentId);
    expect(row).toBeNull();

    // Vote row should also be gone (cascade)
    const votes = await getVoteRows(commentId);
    expect(votes).toHaveLength(0);
  });

  it("tombstones a comment WITH replies (content '[deleted]', isDeleted true, userId null)", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { topicId } = await createTopicWithOptions(caller, "Tombstone Test");

    const parent = await caller.comments.create({
      topicId,
      content: "Parent comment that has a reply",
    });
    // Create a reply using comments.create with parentId
    const reply = await caller.comments.create({
      topicId,
      content: "Reply to parent comment",
      parentId: parent.id,
    });

    const res = await caller.comments.remove({ commentId: parent.id });
    expect(res.success).toBe(true);
    expect(res.mode).toBe("tombstoned");

    // Parent should be tombstoned
    const parentRow = await getCommentRow(parent.id);
    expect(parentRow).not.toBeNull();
    expect(parentRow!.content).toBe("[deleted]");
    expect(parentRow!.isDeleted).toBe(true);
    expect(parentRow!.userId).toBeNull();

    // Reply should remain intact
    const replyRow = await getCommentRow(reply.id);
    expect(replyRow).not.toBeNull();
    expect(replyRow!.content).toBe("Reply to parent comment");
    expect(replyRow!.isDeleted).toBe(false);
  });

  it("non-author non-admin gets FORBIDDEN", async () => {
    const author = await createTestCaller(TEST_USERS.regular.clerkId);
    const { topicId } = await createTopicWithOptions(author, "Forbidden Test");
    const { id: commentId } = await author.comments.create({
      topicId,
      content: "Only author or admin should delete",
    });

    // Create a second non-admin user
    await db.execute(sql`
      INSERT INTO users (clerk_id, username, email, is_admin)
      VALUES ('user_test_other', 'otheruser', 'other@test.dev', false)
      ON CONFLICT DO NOTHING
    `);
    const otherCaller = await createTestCaller("user_test_other");

    await expect(
      otherCaller.comments.remove({ commentId })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("ADMIN can delete another user's comment", async () => {
    const author = await createTestCaller(TEST_USERS.regular.clerkId);
    const { topicId } = await createTopicWithOptions(author, "Admin Delete Test");
    const { id: commentId } = await author.comments.create({
      topicId,
      content: "This will be deleted by admin",
    });

    const admin = await createTestCaller(TEST_USERS.admin.clerkId);
    const res = await admin.comments.remove({ commentId });
    expect(res.success).toBe(true);
    expect(res.mode).toBe("deleted");

    const row = await getCommentRow(commentId);
    expect(row).toBeNull();
  });

  it("PARENT CLEANUP: tombstoned parent with zero children is removed after last child deleted", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { topicId } = await createTopicWithOptions(caller, "Parent Cleanup Test");

    const parent = await caller.comments.create({
      topicId,
      content: "Parent that will become tombstone then cleaned up",
    });
    const child = await caller.comments.create({
      topicId,
      content: "Only child of parent",
      parentId: parent.id,
    });

    // Tombstone the parent (has replies)
    await caller.comments.remove({ commentId: parent.id });
    // Verify parent is tombstoned
    let parentRow = await getCommentRow(parent.id);
    expect(parentRow!.isDeleted).toBe(true);

    // Delete the child (leaf) — should trigger parent cleanup
    const res = await caller.comments.remove({ commentId: child.id });
    expect(res.success).toBe(true);
    expect(res.mode).toBe("deleted+parent");

    // Both child and parent should be gone
    expect(await getCommentRow(child.id)).toBeNull();
    expect(await getCommentRow(parent.id)).toBeNull();
  });

  it("deleting an already-deleted (tombstoned) comment is idempotent", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const admin = await createTestCaller(TEST_USERS.admin.clerkId);
    const { topicId } = await createTopicWithOptions(caller, "Idempotent Delete Test");

    const parent = await caller.comments.create({
      topicId,
      content: "Parent to tombstone then re-delete",
    });
    await caller.comments.create({
      topicId,
      content: "Reply keeps parent alive as tombstone",
      parentId: parent.id,
    });

    // First delete => tombstone (by author)
    await caller.comments.remove({ commentId: parent.id });

    // NOTE: After tombstone, userId is set to null so the original author
    // can no longer pass the ownership check. Only an admin can re-delete.
    // Second delete (by admin) => idempotent
    const res = await admin.comments.remove({ commentId: parent.id });
    expect(res.success).toBe(true);
    expect(res.mode).toBe("already-deleted");
  });
});

// ─── comments.getForTopic ────────────────────────────────────────────────────

describe("comments.getForTopic", () => {
  it("returns top-level comments with nested replies (2 levels)", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { topicId } = await createTopicWithOptions(caller, "GetForTopic Nesting");

    const c1 = await caller.comments.create({ topicId, content: "Top-level comment one" });
    const r1 = await caller.comments.create({
      topicId,
      content: "Reply to comment one",
      parentId: c1.id,
    });

    const result = await caller.comments.getForTopic({ topicId });

    expect(result.comments).toHaveLength(1);
    expect(result.comments[0].id).toBe(c1.id);
    expect(result.comments[0].replies).toHaveLength(1);
    expect(result.comments[0].replies[0].id).toBe(r1.id);
  });

  it("each comment exposes isOwner=true for authoring caller, false for others", async () => {
    const author = await createTestCaller(TEST_USERS.regular.clerkId);
    const { topicId } = await createTopicWithOptions(author, "IsOwner Test");

    await author.comments.create({ topicId, content: "Author's comment for ownership check" });

    // Author sees isOwner=true
    const authorResult = await author.comments.getForTopic({ topicId });
    expect(authorResult.comments[0].isOwner).toBe(true);

    // Admin (different user) sees isOwner=false
    const admin = await createTestCaller(TEST_USERS.admin.clerkId);
    const adminResult = await admin.comments.getForTopic({ topicId });
    expect(adminResult.comments[0].isOwner).toBe(false);

    // Guest sees isOwner=false
    const guest = await createTestCaller(null);
    const guestResult = await guest.comments.getForTopic({ topicId });
    expect(guestResult.comments[0].isOwner).toBe(false);
  });

  it("tombstoned comments show user=null, content='[deleted]', isDeleted=true, but appear with replies", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { topicId } = await createTopicWithOptions(caller, "Tombstone Display Test");

    const parent = await caller.comments.create({
      topicId,
      content: "Parent comment to tombstone for display",
    });
    await caller.comments.create({
      topicId,
      content: "Reply that keeps parent visible",
      parentId: parent.id,
    });

    // Tombstone the parent
    await caller.comments.remove({ commentId: parent.id });

    const result = await caller.comments.getForTopic({ topicId });
    expect(result.comments).toHaveLength(1);
    const displayed = result.comments[0];
    expect(displayed.isDeleted).toBe(true);
    expect(displayed.content).toBe("[deleted]");
    expect(displayed.user).toBeNull();
    // Replies still intact
    expect(displayed.replies).toHaveLength(1);
    expect(displayed.replies[0].isDeleted).toBe(false);
  });

  it("pagination defaults to 20 items with max cap at 50", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { topicId } = await createTopicWithOptions(caller, "Pagination Test");

    // Create 22 top-level comments
    for (let i = 0; i < 22; i++) {
      await caller.comments.create({ topicId, content: `Comment number ${i + 1} for pagination` });
    }

    // Default limit (20)
    const page1 = await caller.comments.getForTopic({ topicId });
    expect(page1.comments).toHaveLength(20);
    expect(page1.nextCursor).not.toBeNull();

    // Second page
    const page2 = await caller.comments.getForTopic({ topicId, cursor: page1.nextCursor! });
    expect(page2.comments).toHaveLength(2);
    expect(page2.nextCursor).toBeNull();

    // Max limit cap: requesting 51 should be rejected by Zod (.max(50))
    await expect(
      caller.comments.getForTopic({ topicId, limit: 51 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("replies expose isDeleted flag correctly", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { topicId } = await createTopicWithOptions(caller, "Reply IsDeleted Test");

    const parent = await caller.comments.create({
      topicId,
      content: "Parent with two replies for deletion test",
    });
    const reply1 = await caller.comments.create({
      topicId,
      content: "First reply to stay alive",
      parentId: parent.id,
    });
    const reply2 = await caller.comments.create({
      topicId,
      content: "Second reply to be deleted",
      parentId: parent.id,
    });

    // Delete reply2 (leaf, hard-delete)
    await caller.comments.remove({ commentId: reply2.id });

    const result = await caller.comments.getForTopic({ topicId });
    // Only reply1 should remain (reply2 is hard-deleted, not tombstoned)
    expect(result.comments[0].replies).toHaveLength(1);
    expect(result.comments[0].replies[0].id).toBe(reply1.id);
    expect(result.comments[0].replies[0].isDeleted).toBe(false);
  });
});
