/**
 * Integration tests for the moderation router.
 * Covers: report, queue, resolve
 */
import { describe, it, expect, beforeEach } from "vitest";
import { resetDb, createTestCaller, TEST_USERS } from "@/test/helpers";
import {
  db, sql, users, topics, comments, reports, options,
  eq, and,
} from "@rateanything/db";

beforeEach(resetDb);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Creates a topic directly via caller, returns { topicId, slug } */
async function seedTopic(
  caller: Awaited<ReturnType<typeof createTestCaller>>,
  title: string,
) {
  const result = await caller.topics.create({
    title,
    categoryId: 1,
    options: [{ name: "Opt A" }, { name: "Opt B" }],
  });
  const [topic] = await db.select().from(topics).where(eq(topics.slug, result.slug)).limit(1);
  return { topicId: topic.id, slug: topic.slug };
}

/** Creates a comment directly in the DB for seeding */
async function seedComment(topicId: string, userId: string, content: string) {
  const [comment] = await db
    .insert(comments)
    .values({ topicId, userId, content })
    .returning({ id: comments.id });
  return comment.id;
}

/** Gets a user's internal UUID by clerkId */
async function getDbUserId(clerkId: string) {
  const [row] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
  return row!.id;
}

/** Creates an additional test user for multi-reporter scenarios */
async function createExtraUser(suffix: string) {
  const [user] = await db
    .insert(users)
    .values({
      clerkId: `user_extra_${suffix}`,
      username: `extra_${suffix}`,
      email: `extra_${suffix}@test.dev`,
    })
    .returning({ id: users.id, clerkId: users.clerkId });
  return user;
}

// ─── report (protected) ──────────────────────────────────────────────────────

describe("moderation.report", () => {
  it("guest caller is rejected with UNAUTHORIZED", async () => {
    const guest = await createTestCaller(null);
    await expect(
      guest.moderation.report({
        targetType: "topic",
        targetId: crypto.randomUUID(),
        reason: "spam",
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("persists a report with each valid reason enum", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { topicId } = await seedTopic(caller, "Reasons Test Topic");
    const reasons = ["spam", "harassment", "hate_speech", "off_topic", "private_individual", "other"] as const;

    for (const reason of reasons) {
      const result = await caller.moderation.report({
        targetType: "topic",
        targetId: topicId,
        reason,
      });
      expect(result.id).toBeDefined();
      expect(result.createdAt).toBeDefined();
    }

    // Verify all 6 reports persisted
    const allReports = await db
      .select()
      .from(reports)
      .where(eq(reports.targetId, topicId));
    expect(allReports).toHaveLength(6);
  });

  it("persists a report with each valid target type", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { topicId } = await seedTopic(caller, "TargetType Test Topic");
    const userId = await getDbUserId(TEST_USERS.regular.clerkId);
    const commentId = await seedComment(topicId, userId, "Test comment for report");

    // topic
    const r1 = await caller.moderation.report({
      targetType: "topic",
      targetId: topicId,
      reason: "spam",
    });
    expect(r1.id).toBeDefined();

    // comment
    const r2 = await caller.moderation.report({
      targetType: "comment",
      targetId: commentId,
      reason: "harassment",
    });
    expect(r2.id).toBeDefined();

    // user
    const r3 = await caller.moderation.report({
      targetType: "user",
      targetId: userId,
      reason: "hate_speech",
    });
    expect(r3.id).toBeDefined();

    // rating - use a random UUID since no FK constraint on targetId
    const r4 = await caller.moderation.report({
      targetType: "rating",
      targetId: crypto.randomUUID(),
      reason: "off_topic",
    });
    expect(r4.id).toBeDefined();
  });

  it("rejects invalid reason with schema validation error", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    await expect(
      caller.moderation.report({
        targetType: "topic",
        targetId: crypto.randomUUID(),
        reason: "invalid_reason" as never,
      }),
    ).rejects.toThrow();
  });

  it("rejects invalid targetType with schema validation error", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    await expect(
      caller.moderation.report({
        targetType: "invalid_target" as never,
        targetId: crypto.randomUUID(),
        reason: "spam",
      }),
    ).rejects.toThrow();
  });

  // Zod schema correctly validates max 500 chars matching the DB varchar(500) column.
  it("accepts details up to 500 characters (actual DB limit)", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const details500 = "a".repeat(500);
    const result = await caller.moderation.report({
      targetType: "topic",
      targetId: crypto.randomUUID(),
      reason: "other",
      details: details500,
    });
    expect(result.id).toBeDefined();
  });

  // FIXED: Zod schema now correctly validates max(500) to match DB varchar(500).
  // Values > 500 are rejected at the Zod validation layer before reaching the DB.
  it("details between 501-1000 chars are rejected by Zod validation (max 500)", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const details501 = "a".repeat(501);
    // Zod now rejects > 500 chars before it reaches the DB
    await expect(
      caller.moderation.report({
        targetType: "topic",
        targetId: crypto.randomUUID(),
        reason: "other",
        details: details501,
      }),
    ).rejects.toThrow();
  });

  it("rejects details exceeding 1000 characters (Zod validation)", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const details1001 = "a".repeat(1001);
    await expect(
      caller.moderation.report({
        targetType: "topic",
        targetId: crypto.randomUUID(),
        reason: "other",
        details: details1001,
      }),
    ).rejects.toThrow();
  });

  // NOTE: PRODUCT.md says "Auto-hide if 5+ flags" — code uses >= 5 distinct reporters, which matches.
  it("auto-hides a topic after 5 distinct reporters", async () => {
    const adminCaller = await createTestCaller(TEST_USERS.admin.clerkId);
    const { topicId } = await seedTopic(adminCaller, "AutoHide Topic Test");

    // Create 5 extra users and have each report the topic
    for (let i = 1; i <= 5; i++) {
      const extra = await createExtraUser(`autohide_${i}`);
      const extraCaller = await createTestCaller(extra.clerkId);
      await extraCaller.moderation.report({
        targetType: "topic",
        targetId: topicId,
        reason: "spam",
      });
    }

    // Verify topic is now archived (auto-hidden)
    const [topic] = await db.select().from(topics).where(eq(topics.id, topicId)).limit(1);
    expect(topic.status).toBe("archived");
  });

  it("auto-hides a comment after 5 distinct reporters (replaces content)", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { topicId } = await seedTopic(caller, "AutoHide Comment Test");
    const userId = await getDbUserId(TEST_USERS.regular.clerkId);
    const commentId = await seedComment(topicId, userId, "Original content");

    // 5 distinct reporters
    for (let i = 1; i <= 5; i++) {
      const extra = await createExtraUser(`autohide_c_${i}`);
      const extraCaller = await createTestCaller(extra.clerkId);
      await extraCaller.moderation.report({
        targetType: "comment",
        targetId: commentId,
        reason: "harassment",
      });
    }

    // Verify comment content replaced
    const [comment] = await db.select().from(comments).where(eq(comments.id, commentId)).limit(1);
    expect(comment.content).toBe("[auto-hidden: community flagged]");
  });

  it("does NOT auto-hide with fewer than 5 distinct reporters", async () => {
    const adminCaller = await createTestCaller(TEST_USERS.admin.clerkId);
    const { topicId } = await seedTopic(adminCaller, "NoAutoHide Topic");

    // Only 4 distinct reporters
    for (let i = 1; i <= 4; i++) {
      const extra = await createExtraUser(`no_autohide_${i}`);
      const extraCaller = await createTestCaller(extra.clerkId);
      await extraCaller.moderation.report({
        targetType: "topic",
        targetId: topicId,
        reason: "spam",
      });
    }

    // Verify topic is still active
    const [topic] = await db.select().from(topics).where(eq(topics.id, topicId)).limit(1);
    expect(topic.status).toBe("active");
  });
});

// ─── queue (admin) ────────────────────────────────────────────────────────────

describe("moderation.queue", () => {
  it("guest caller is rejected with UNAUTHORIZED", async () => {
    const guest = await createTestCaller(null);
    await expect(
      guest.moderation.queue({ status: "pending" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("regular (non-admin) caller is rejected with FORBIDDEN", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    await expect(
      caller.moderation.queue({ status: "pending" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("admin caller returns pending reports", async () => {
    // Seed some reports
    const regularCaller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { topicId } = await seedTopic(regularCaller, "Queue Test Topic");
    await regularCaller.moderation.report({
      targetType: "topic",
      targetId: topicId,
      reason: "spam",
    });
    await regularCaller.moderation.report({
      targetType: "topic",
      targetId: topicId,
      reason: "harassment",
      details: "Some detail for queue test",
    });

    const adminCaller = await createTestCaller(TEST_USERS.admin.clerkId);
    const result = await adminCaller.moderation.queue({ status: "pending" });
    expect(result.reports.length).toBeGreaterThanOrEqual(2);
    expect(result.reports[0]).toMatchObject({
      targetType: "topic",
      targetId: topicId,
      status: "pending",
    });
    // Reports should include reporter info
    expect(result.reports[0].reporter).toMatchObject({
      username: TEST_USERS.regular.username,
    });
  });

  it("queue returns reports ordered by createdAt DESC", async () => {
    const regularCaller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { topicId } = await seedTopic(regularCaller, "Order Test Topic");
    await regularCaller.moderation.report({
      targetType: "topic",
      targetId: topicId,
      reason: "spam",
    });
    await regularCaller.moderation.report({
      targetType: "topic",
      targetId: topicId,
      reason: "harassment",
    });

    const adminCaller = await createTestCaller(TEST_USERS.admin.clerkId);
    const result = await adminCaller.moderation.queue({ status: "pending" });
    // Most recent first
    for (let i = 0; i < result.reports.length - 1; i++) {
      expect(
        new Date(result.reports[i].createdAt).getTime(),
      ).toBeGreaterThanOrEqual(
        new Date(result.reports[i + 1].createdAt).getTime(),
      );
    }
  });
});

// ─── resolve (admin) ──────────────────────────────────────────────────────────

describe("moderation.resolve", () => {
  it("guest caller is rejected with UNAUTHORIZED", async () => {
    const guest = await createTestCaller(null);
    await expect(
      guest.moderation.resolve({
        reportId: crypto.randomUUID(),
        action: "dismiss",
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("regular (non-admin) caller is rejected with FORBIDDEN", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    await expect(
      caller.moderation.resolve({
        reportId: crypto.randomUUID(),
        action: "dismiss",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  // FIXED: The resolve handler now correctly maps actions to valid DB statuses:
  // 'dismiss' -> 'dismissed', 'remove'/'warn'/'ban' -> 'actioned'.
  // DB CHECK constraint allows: 'pending', 'reviewed', 'actioned', 'dismissed', 'appealed'.

  it("admin can dismiss a report -> status becomes 'dismissed'", async () => {
    const regularCaller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { topicId } = await seedTopic(regularCaller, "Resolve Dismiss Topic");
    const report = await regularCaller.moderation.report({
      targetType: "topic",
      targetId: topicId,
      reason: "spam",
    });

    const adminCaller = await createTestCaller(TEST_USERS.admin.clerkId);
    const result = await adminCaller.moderation.resolve({
      reportId: report.id,
      action: "dismiss",
    });
    expect(result).toEqual({ success: true, action: "dismiss" });

    // Verify status transition in DB
    const [resolved] = await db.select().from(reports).where(eq(reports.id, report.id)).limit(1);
    expect(resolved.status).toBe("dismissed");
    expect(resolved.resolvedAt).not.toBeNull();
  });

  // FIXED: 'remove' action now correctly sets status='actioned' which is in DB check constraint.
  it("resolve with 'remove' succeeds and sets status to 'actioned'", async () => {
    const regularCaller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { topicId } = await seedTopic(regularCaller, "Resolve Remove Topic");
    const report = await regularCaller.moderation.report({
      targetType: "topic",
      targetId: topicId,
      reason: "spam",
    });

    const adminCaller = await createTestCaller(TEST_USERS.admin.clerkId);
    const result = await adminCaller.moderation.resolve({
      reportId: report.id,
      action: "remove",
    });
    expect(result).toEqual({ success: true, action: "remove" });

    // Verify status in DB
    const [resolved] = await db.select().from(reports).where(eq(reports.id, report.id)).limit(1);
    expect(resolved.status).toBe("actioned");
    expect(resolved.resolvedAt).not.toBeNull();
  });

  // FIXED: 'warn' action now correctly sets status='actioned'
  it("resolve with 'warn' succeeds and sets status to 'actioned'", async () => {
    const regularCaller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { topicId } = await seedTopic(regularCaller, "Resolve Warn Topic");
    const report = await regularCaller.moderation.report({
      targetType: "topic",
      targetId: topicId,
      reason: "spam",
    });

    const adminCaller = await createTestCaller(TEST_USERS.admin.clerkId);
    const result = await adminCaller.moderation.resolve({
      reportId: report.id,
      action: "warn",
    });
    expect(result).toEqual({ success: true, action: "warn" });

    // Verify status in DB
    const [resolved] = await db.select().from(reports).where(eq(reports.id, report.id)).limit(1);
    expect(resolved.status).toBe("actioned");
  });

  // FIXED: 'ban' action now correctly sets status='actioned'
  it("resolve with 'ban' succeeds and sets status to 'actioned'", async () => {
    const regularCaller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { topicId } = await seedTopic(regularCaller, "Resolve Ban Topic");
    const report = await regularCaller.moderation.report({
      targetType: "topic",
      targetId: topicId,
      reason: "spam",
    });

    const adminCaller = await createTestCaller(TEST_USERS.admin.clerkId);
    const result = await adminCaller.moderation.resolve({
      reportId: report.id,
      action: "ban",
    });
    expect(result).toEqual({ success: true, action: "ban" });

    // Verify status in DB
    const [resolved] = await db.select().from(reports).where(eq(reports.id, report.id)).limit(1);
    expect(resolved.status).toBe("actioned");
  });

  it("resolving a non-existent report throws NOT_FOUND", async () => {
    const adminCaller = await createTestCaller(TEST_USERS.admin.clerkId);
    await expect(
      adminCaller.moderation.resolve({
        reportId: crypto.randomUUID(),
        action: "dismiss",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("resolving an already-dismissed report throws BAD_REQUEST", async () => {
    const regularCaller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { topicId } = await seedTopic(regularCaller, "Double Resolve Topic");
    const report = await regularCaller.moderation.report({
      targetType: "topic",
      targetId: topicId,
      reason: "spam",
    });

    const adminCaller = await createTestCaller(TEST_USERS.admin.clerkId);
    await adminCaller.moderation.resolve({ reportId: report.id, action: "dismiss" });

    // Second resolution should fail
    await expect(
      adminCaller.moderation.resolve({ reportId: report.id, action: "dismiss" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
