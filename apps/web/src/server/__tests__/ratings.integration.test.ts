/**
 * Integration tests for the ratings router.
 * Covers: submit, remove, getForOption, getMyRating, getForGuest
 */
import { describe, it, expect, beforeEach } from "vitest";
import { resetDb, createTestCaller, TEST_USERS } from "@/test/helpers";
import { db, sql, options, ratings, users, topics, guests, eq, and, count, sum, avg } from "@rateanything/db";

beforeEach(resetDb);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Creates a topic with N options, returns topicId + optionIds */
async function createTopicWithOptions(
  caller: Awaited<ReturnType<typeof createTestCaller>>,
  title: string,
  numOptions = 2,
  categoryId = 1
) {
  const opts = Array.from({ length: numOptions }, (_, i) => ({
    name: `${title} Option ${i + 1}`,
  }));
  const { id: topicId } = await caller.topics.create({
    title,
    categoryId,
    options: opts,
  });
  // Fetch the created option IDs in sort order
  const createdOptions = await db
    .select({ id: options.id, name: options.name })
    .from(options)
    .where(eq(options.topicId, topicId))
    .orderBy(options.sortOrder);
  return { topicId, optionIds: createdOptions.map((o) => o.id) };
}

/** Helper to query option stats directly from DB */
async function getOptionStats(optionId: string) {
  const [opt] = await db
    .select({
      avgRating: options.avgRating,
      ratingCount: options.ratingCount,
      ratingSum: options.ratingSum,
    })
    .from(options)
    .where(eq(options.id, optionId))
    .limit(1);
  return opt;
}

/** Helper to query topic totalRatings directly */
async function getTopicTotalRatings(topicId: string) {
  const [t] = await db
    .select({ totalRatings: topics.totalRatings })
    .from(topics)
    .where(eq(topics.id, topicId))
    .limit(1);
  return t.totalRatings;
}

/** Helper to query user ratingCount */
async function getUserRatingCount(clerkId: string) {
  const [u] = await db
    .select({ ratingCount: users.ratingCount })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);
  return u.ratingCount;
}

/** Zero-drift check: verify stored option stats equal fresh recompute */
async function assertZeroDrift(optionId: string) {
  const stored = await getOptionStats(optionId);
  const [fresh] = await db
    .select({
      cnt: sql<number>`count(*)::int`,
      total: sql<number>`coalesce(sum(score)::int, 0)`,
      average: sql<number>`coalesce(avg(score)::real, 0)`,
    })
    .from(ratings)
    .where(eq(ratings.optionId, optionId));
  expect(stored.ratingCount).toBe(fresh.cnt);
  expect(stored.ratingSum).toBe(fresh.total);
  expect(stored.avgRating).toBeCloseTo(fresh.average, 4);
}

// ─── SUBMIT ───────────────────────────────────────────────────────────────────

describe("ratings.submit", () => {
  it("new authed rating updates option avgRating/ratingCount/ratingSum, topic totalRatings, user ratingCount", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { topicId, optionIds } = await createTopicWithOptions(caller, "Submit Basic Test");

    const result = await caller.ratings.submit({ optionId: optionIds[0], score: 7 });

    expect(result.optionRatingCount).toBe(1);
    expect(result.optionAvgRating).toBe(7);

    const stats = await getOptionStats(optionIds[0]);
    expect(stats.ratingCount).toBe(1);
    expect(stats.ratingSum).toBe(7);
    expect(stats.avgRating).toBe(7);

    expect(await getTopicTotalRatings(topicId)).toBe(1);
    expect(await getUserRatingCount(TEST_USERS.regular.clerkId)).toBe(1);
  });

  it("RE-RATE (same user+option) updates score without incrementing count (upsert, delta applied)", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { optionIds } = await createTopicWithOptions(caller, "Re-Rate Test");

    await caller.ratings.submit({ optionId: optionIds[0], score: 4 });
    const result = await caller.ratings.submit({ optionId: optionIds[0], score: 9 });

    expect(result.optionRatingCount).toBe(1);
    expect(result.optionAvgRating).toBe(9);

    const stats = await getOptionStats(optionIds[0]);
    expect(stats.ratingCount).toBe(1);
    expect(stats.ratingSum).toBe(9);
    expect(stats.avgRating).toBe(9);

    // User ratingCount should still be 1 (no double-increment)
    expect(await getUserRatingCount(TEST_USERS.regular.clerkId)).toBe(1);
  });

  it("score bounds: 0 and 11 rejected by schema, 1 and 10 accepted", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { optionIds } = await createTopicWithOptions(caller, "Bounds Test");

    // 0 rejected
    await expect(
      caller.ratings.submit({ optionId: optionIds[0], score: 0 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    // 11 rejected
    await expect(
      caller.ratings.submit({ optionId: optionIds[0], score: 11 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    // 1 accepted
    const r1 = await caller.ratings.submit({ optionId: optionIds[0], score: 1 });
    expect(r1.optionAvgRating).toBe(1);

    // 10 accepted (re-rate same option)
    const r10 = await caller.ratings.submit({ optionId: optionIds[0], score: 10 });
    expect(r10.optionAvgRating).toBe(10);
  });

  it("non-integer score rejected", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { optionIds } = await createTopicWithOptions(caller, "NonInt Test");

    await expect(
      caller.ratings.submit({ optionId: optionIds[0], score: 5.5 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("guest rating via guestFingerprint creates a guest row + rating", async () => {
    const authedCaller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { optionIds } = await createTopicWithOptions(authedCaller, "Guest Rating Test");

    const guest = await createTestCaller(null);
    const fingerprint = "fp_guest_test_001";

    const result = await guest.ratings.submit({
      optionId: optionIds[0],
      score: 6,
      guestFingerprint: fingerprint,
    });

    expect(result.optionRatingCount).toBe(1);
    expect(result.optionAvgRating).toBe(6);

    // Verify guest row was created
    const [guestRow] = await db
      .select({ id: guests.id })
      .from(guests)
      .where(eq(guests.fingerprintHash, fingerprint))
      .limit(1);
    expect(guestRow).toBeDefined();
    expect(guestRow.id).toBeTruthy();
  });

  it("GUEST 3-DISTINCT-TOPIC CAP: 4th distinct topic rejected FORBIDDEN", async () => {
    const authedCaller = await createTestCaller(TEST_USERS.regular.clerkId);
    const guest = await createTestCaller(null);
    const fingerprint = "fp_cap_test_001";

    // Create 4 distinct topics
    const topicResults = await Promise.all(
      [1, 2, 3, 4].map((i) =>
        createTopicWithOptions(authedCaller, `Cap Topic ${i} Unique`)
      )
    );

    // Rate one option in each of the first 3 topics — should work
    for (let i = 0; i < 3; i++) {
      await guest.ratings.submit({
        optionId: topicResults[i].optionIds[0],
        score: 5,
        guestFingerprint: fingerprint,
      });
    }

    // 4th distinct topic → FORBIDDEN
    await expect(
      guest.ratings.submit({
        optionId: topicResults[3].optionIds[0],
        score: 5,
        guestFingerprint: fingerprint,
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: expect.stringContaining("Guests can rate up to 3 topics"),
    });
  });

  it("guest re-rating an ALREADY-rated topic (same topic) still allowed after cap", async () => {
    const authedCaller = await createTestCaller(TEST_USERS.regular.clerkId);
    const guest = await createTestCaller(null);
    const fingerprint = "fp_rerate_cap_001";

    const topicResults = await Promise.all(
      [1, 2, 3].map((i) =>
        createTopicWithOptions(authedCaller, `Rerate Cap Topic ${i}`)
      )
    );

    // Rate 3 distinct topics
    for (let i = 0; i < 3; i++) {
      await guest.ratings.submit({
        optionId: topicResults[i].optionIds[0],
        score: 5,
        guestFingerprint: fingerprint,
      });
    }

    // Re-rate same option in topic 1 (still same 3 distinct topics) — should succeed
    const result = await guest.ratings.submit({
      optionId: topicResults[0].optionIds[0],
      score: 8,
      guestFingerprint: fingerprint,
    });
    expect(result.optionAvgRating).toBe(8);
  });

  it("guest rating a second option within an already-rated topic is allowed (cap is distinct TOPICS)", async () => {
    const authedCaller = await createTestCaller(TEST_USERS.regular.clerkId);
    const guest = await createTestCaller(null);
    const fingerprint = "fp_second_opt_001";

    const topicResults = await Promise.all(
      [1, 2, 3].map((i) =>
        createTopicWithOptions(authedCaller, `Second Opt Topic ${i}`, 3)
      )
    );

    // Rate 3 distinct topics (one option each)
    for (let i = 0; i < 3; i++) {
      await guest.ratings.submit({
        optionId: topicResults[i].optionIds[0],
        score: 5,
        guestFingerprint: fingerprint,
      });
    }

    // Rate a SECOND option in topic 1 — still the same 3 distinct topics, should succeed
    const result = await guest.ratings.submit({
      optionId: topicResults[0].optionIds[1],
      score: 7,
      guestFingerprint: fingerprint,
    });
    expect(result.optionRatingCount).toBe(1);
    expect(result.optionAvgRating).toBe(7);
  });

  it("neither auth nor fingerprint -> BAD_REQUEST", async () => {
    const authedCaller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { optionIds } = await createTopicWithOptions(authedCaller, "No Auth Test");

    const guest = await createTestCaller(null);
    await expect(
      guest.ratings.submit({ optionId: optionIds[0], score: 5 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("option not found -> NOT_FOUND", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    await expect(
      caller.ratings.submit({ optionId: "00000000-0000-0000-0000-000000000000", score: 5 })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("comment >500 chars rejected, <=500 ok", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { optionIds } = await createTopicWithOptions(caller, "Comment Len Test");

    // NOTE: Zod schema allows .max(1000) but DB column is varchar(500).
    // Actual behavior: <=500 is accepted, >500 and <=1000 causes a DB-level error,
    // >1000 is caught by Zod validation (BAD_REQUEST).
    // Testing the effective limit: 500 OK, 501 throws (DB error).
    const ok = await caller.ratings.submit({
      optionId: optionIds[0],
      score: 5,
      comment: "a".repeat(500),
    });
    expect(ok.optionRatingCount).toBe(1);

    // 501 chars rejected at DB level (throws INTERNAL_SERVER_ERROR)
    await expect(
      caller.ratings.submit({
        optionId: optionIds[0],
        score: 5,
        comment: "b".repeat(501),
      })
    ).rejects.toThrow();

    // >1000 chars rejected by Zod (BAD_REQUEST)
    await expect(
      caller.ratings.submit({
        optionId: optionIds[0],
        score: 5,
        comment: "c".repeat(1001),
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("tags >5 rejected, tags with item >30 chars rejected by Zod; DB enforces varchar(20)", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { optionIds } = await createTopicWithOptions(caller, "Tags Limit Test");

    // >5 tags rejected by Zod
    await expect(
      caller.ratings.submit({
        optionId: optionIds[0],
        score: 5,
        tags: ["a", "b", "c", "d", "e", "f"],
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    // Tag >30 chars rejected by Zod
    await expect(
      caller.ratings.submit({
        optionId: optionIds[0],
        score: 5,
        tags: ["a".repeat(31)],
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    // NOTE: DB column is varchar(20), so >20 chars fails at DB level even though Zod allows up to 30.
    // BUG: Zod schema allows tags up to 30 chars but DB column is varchar(20) — mismatch.
    // Testing actual effective limit: 20 chars OK, 21 chars throws DB error.
    const ok = await caller.ratings.submit({
      optionId: optionIds[0],
      score: 5,
      tags: ["a".repeat(20), "b", "c", "d", "e"],
    });
    expect(ok.optionRatingCount).toBe(1);

    // 21-char tag passes Zod (.max(30)) but fails at DB (varchar(20))
    await expect(
      caller.ratings.submit({
        optionId: optionIds[0],
        score: 6,
        tags: ["x".repeat(21)],
      })
    ).rejects.toThrow();
  });

  it("ZERO-DRIFT: after several submits, stored option stats equal fresh recompute", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const adminCaller = await createTestCaller(TEST_USERS.admin.clerkId);
    const guest = await createTestCaller(null);
    const { optionIds } = await createTopicWithOptions(caller, "Zero Drift Submit");

    // Multiple submits from different users
    await caller.ratings.submit({ optionId: optionIds[0], score: 3 });
    await adminCaller.ratings.submit({ optionId: optionIds[0], score: 8 });
    await guest.ratings.submit({ optionId: optionIds[0], score: 5, guestFingerprint: "fp_drift_001" });

    // Re-rate by first user
    await caller.ratings.submit({ optionId: optionIds[0], score: 10 });

    await assertZeroDrift(optionIds[0]);
  });
});

// ─── REMOVE ───────────────────────────────────────────────────────────────────

describe("ratings.remove", () => {
  it("cancels an existing rating -> option count-1, sum-oldScore, avg recomputed", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const adminCaller = await createTestCaller(TEST_USERS.admin.clerkId);
    const { optionIds } = await createTopicWithOptions(caller, "Remove Basic");

    await caller.ratings.submit({ optionId: optionIds[0], score: 6 });
    await adminCaller.ratings.submit({ optionId: optionIds[0], score: 10 });

    // Remove the first user's rating
    const result = await caller.ratings.remove({ optionId: optionIds[0] });

    expect(result.optionRatingCount).toBe(1);
    expect(result.optionAvgRating).toBe(10);

    const stats = await getOptionStats(optionIds[0]);
    expect(stats.ratingCount).toBe(1);
    expect(stats.ratingSum).toBe(10);
    expect(stats.avgRating).toBe(10);
  });

  it("cancel-to-zero -> count 0 + avg 0", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { optionIds } = await createTopicWithOptions(caller, "Remove To Zero");

    await caller.ratings.submit({ optionId: optionIds[0], score: 7 });
    const result = await caller.ratings.remove({ optionId: optionIds[0] });

    expect(result.optionRatingCount).toBe(0);
    expect(result.optionAvgRating).toBe(0);

    const stats = await getOptionStats(optionIds[0]);
    expect(stats.ratingCount).toBe(0);
    expect(stats.ratingSum).toBe(0);
    expect(stats.avgRating).toBe(0);
  });

  it("double-remove is idempotent (no error, returns current stats)", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { optionIds } = await createTopicWithOptions(caller, "Double Remove");

    await caller.ratings.submit({ optionId: optionIds[0], score: 5 });
    await caller.ratings.remove({ optionId: optionIds[0] });

    // Second remove — should not throw
    const result = await caller.ratings.remove({ optionId: optionIds[0] });
    expect(result.optionRatingCount).toBe(0);
    expect(result.optionAvgRating).toBe(0);
  });

  it("guest remove via fingerprint", async () => {
    const authedCaller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { optionIds } = await createTopicWithOptions(authedCaller, "Guest Remove");

    const guest = await createTestCaller(null);
    const fingerprint = "fp_remove_guest_001";

    await guest.ratings.submit({ optionId: optionIds[0], score: 8, guestFingerprint: fingerprint });
    const result = await guest.ratings.remove({ optionId: optionIds[0], guestFingerprint: fingerprint });

    expect(result.optionRatingCount).toBe(0);
    expect(result.optionAvgRating).toBe(0);
  });

  it("removing when no rating exists returns current option stats (idempotent)", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { optionIds } = await createTopicWithOptions(caller, "Remove No Rating");

    // Never rated, just remove
    const result = await caller.ratings.remove({ optionId: optionIds[0] });
    expect(result.optionRatingCount).toBe(0);
    expect(result.optionAvgRating).toBe(0);
  });

  it("after remove, zero-drift holds", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const adminCaller = await createTestCaller(TEST_USERS.admin.clerkId);
    const { optionIds } = await createTopicWithOptions(caller, "Remove ZeroDrift");

    await caller.ratings.submit({ optionId: optionIds[0], score: 3 });
    await adminCaller.ratings.submit({ optionId: optionIds[0], score: 9 });
    await caller.ratings.remove({ optionId: optionIds[0] });

    await assertZeroDrift(optionIds[0]);
  });
});

// ─── getForOption ─────────────────────────────────────────────────────────────

describe("ratings.getForOption", () => {
  it("returns ratings for an option", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { optionIds } = await createTopicWithOptions(caller, "GetForOption Basic");

    await caller.ratings.submit({ optionId: optionIds[0], score: 7, comment: "great" });

    const result = await caller.ratings.getForOption({ optionId: optionIds[0] });
    expect(result.ratings).toHaveLength(1);
    expect(result.ratings[0].score).toBe(7);
    expect(result.ratings[0].comment).toBe("great");
    expect(result.ratings[0].user).not.toBeNull();
    expect(result.ratings[0].user!.username).toBe(TEST_USERS.regular.username);
  });

  it("pagination default limit 20 and max 100 (cap applied)", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { optionIds } = await createTopicWithOptions(caller, "GetForOpt Pagination");

    // Default limit is 20 (no explicit limit passed)
    const result = await caller.ratings.getForOption({ optionId: optionIds[0] });
    // No error, returned (empty list is fine — just testing the call works with default)
    expect(result.ratings).toBeDefined();

    // Limit above 100 rejected by schema (max 100)
    await expect(
      caller.ratings.getForOption({ optionId: optionIds[0], limit: 101 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    // Limit of 100 is fine
    const r100 = await caller.ratings.getForOption({ optionId: optionIds[0], limit: 100 });
    expect(r100.ratings).toBeDefined();
  });

  it("sort modes (newest, hot, controversial) each return without error", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const adminCaller = await createTestCaller(TEST_USERS.admin.clerkId);
    const { optionIds } = await createTopicWithOptions(caller, "Sort Modes Test");

    await caller.ratings.submit({ optionId: optionIds[0], score: 3 });
    await adminCaller.ratings.submit({ optionId: optionIds[0], score: 9 });

    const newest = await caller.ratings.getForOption({ optionId: optionIds[0], sort: "newest" });
    expect(newest.ratings).toHaveLength(2);
    // newest: most recent first (admin rated after regular)
    expect(newest.ratings[0].score).toBe(9);
    expect(newest.ratings[1].score).toBe(3);

    const hot = await caller.ratings.getForOption({ optionId: optionIds[0], sort: "hot" });
    expect(hot.ratings).toHaveLength(2);
    // hot: highest score first
    expect(hot.ratings[0].score).toBe(9);
    expect(hot.ratings[1].score).toBe(3);

    const controversial = await caller.ratings.getForOption({ optionId: optionIds[0], sort: "controversial" });
    expect(controversial.ratings).toHaveLength(2);
    // controversial: furthest from average (avg=6, so 9 and 3 are both 3 away — order by id desc)
    expect(controversial.ratings.length).toBe(2);
  });

  it("cursor pagination returns nextCursor and next page continues correctly", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const guest = await createTestCaller(null);
    const { optionIds } = await createTopicWithOptions(caller, "Cursor Pag Test");

    // Create 3 ratings (one from auth user, two from guests)
    await caller.ratings.submit({ optionId: optionIds[0], score: 3 });
    await guest.ratings.submit({ optionId: optionIds[0], score: 5, guestFingerprint: "fp_pag_1" });
    await guest.ratings.submit({ optionId: optionIds[0], score: 8, guestFingerprint: "fp_pag_2" });

    // Fetch page 1 with limit 2
    const page1 = await caller.ratings.getForOption({
      optionId: optionIds[0],
      limit: 2,
      sort: "newest",
    });
    expect(page1.ratings).toHaveLength(2);
    expect(page1.nextCursor).not.toBeNull();

    // Fetch page 2
    const page2 = await caller.ratings.getForOption({
      optionId: optionIds[0],
      limit: 2,
      sort: "newest",
      cursor: page1.nextCursor!,
    });
    expect(page2.ratings).toHaveLength(1);
    expect(page2.nextCursor).toBeNull();

    // Ensure no overlap
    const allIds = [...page1.ratings.map((r) => r.id), ...page2.ratings.map((r) => r.id)];
    expect(new Set(allIds).size).toBe(3);
  });
});

// ─── getMyRating ──────────────────────────────────────────────────────────────

describe("ratings.getMyRating", () => {
  it("returns the caller's score for an option", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { optionIds } = await createTopicWithOptions(caller, "GetMyRating Has");

    await caller.ratings.submit({ optionId: optionIds[0], score: 8 });

    const result = await caller.ratings.getMyRating({ optionId: optionIds[0] });
    expect(result.score).toBe(8);
  });

  it("returns null score when no rating exists", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { optionIds } = await createTopicWithOptions(caller, "GetMyRating None");

    const result = await caller.ratings.getMyRating({ optionId: optionIds[0] });
    expect(result.score).toBeNull();
  });

  it("requires authentication (guest cannot call)", async () => {
    const authedCaller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { optionIds } = await createTopicWithOptions(authedCaller, "GetMyRating Auth");

    const guest = await createTestCaller(null);
    await expect(
      guest.ratings.getMyRating({ optionId: optionIds[0] })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

// ─── getForGuest ──────────────────────────────────────────────────────────────

describe("ratings.getForGuest", () => {
  it("returns guest score for a rated option", async () => {
    const authedCaller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { optionIds } = await createTopicWithOptions(authedCaller, "GetForGuest Has");

    const guest = await createTestCaller(null);
    const fingerprint = "fp_getforguest_001";
    await guest.ratings.submit({ optionId: optionIds[0], score: 4, guestFingerprint: fingerprint });

    const result = await guest.ratings.getForGuest({
      optionId: optionIds[0],
      fingerprint,
    });
    expect(result.score).toBe(4);
  });

  it("returns null score for unknown fingerprint", async () => {
    const authedCaller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { optionIds } = await createTopicWithOptions(authedCaller, "GetForGuest Unknown");

    const guest = await createTestCaller(null);
    const result = await guest.ratings.getForGuest({
      optionId: optionIds[0],
      fingerprint: "fp_totally_unknown",
    });
    expect(result.score).toBeNull();
  });

  it("returns null when guest exists but has not rated this option", async () => {
    const authedCaller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { optionIds } = await createTopicWithOptions(authedCaller, "GetForGuest NoRate", 3);

    const guest = await createTestCaller(null);
    const fingerprint = "fp_getforguest_norate";
    // Rate option 0 but query option 1
    await guest.ratings.submit({ optionId: optionIds[0], score: 6, guestFingerprint: fingerprint });

    const result = await guest.ratings.getForGuest({
      optionId: optionIds[1],
      fingerprint,
    });
    expect(result.score).toBeNull();
  });
});
