/**
 * Integration tests for the arena router.
 * Covers: getPair, vote, skip, getLeaderboard, validation, rate limits,
 * duplicate detection (UNIQUE constraint), Elo correctness, and concurrency safety.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { createTestCaller, TEST_USERS } from "@/test/helpers";
import { db, sql, options, optionEloStats, arenaVotes, eq, and } from "@rateanything/db";
import { calculateElo, ELO_INITIAL } from "@/lib/elo";

// Custom beforeEach: uses db.transaction to pin SET LOCAL + TRUNCATE to a single
// pool connection, preventing deadlocks with concurrent tests that hold row locks
// on other pool connections. Retries on deadlock (40P01) or lock_timeout (55P03).
beforeEach(async () => {
  const MAX_RETRIES = 20;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await db.transaction(async (tx) => {
        await tx.execute(sql`SET LOCAL lock_timeout = '1s'`);
        await tx.execute(sql`
          TRUNCATE
            users, topics, options, ratings, comments, comment_votes,
            guests, reports, follows, categories, badges, user_badges,
            arena_votes, option_elo_stats
          RESTART IDENTITY CASCADE
        `);
      });
      break;
    } catch (err: unknown) {
      const pgCode = (err as { code?: string }).code;
      if ((pgCode === "40P01" || pgCode === "55P03") && attempt < MAX_RETRIES) {
        await new Promise((r) => globalThis.setTimeout(r, 100 * attempt));
        continue;
      }
      throw err;
    }
  }
  // Re-seed baseline
  await db.execute(sql`
    INSERT INTO categories (name, slug, description, sort_order) VALUES
      ('Sports', 'sports', 'Athletic competitions, teams, and players', 1),
      ('Movies & TV', 'movies-tv', 'Films, television shows, and streaming content', 2),
      ('Technology', 'tech', 'Software, hardware, gadgets, and innovation', 3),
      ('Music', 'music', 'Artists, albums, genres, and concerts', 4),
      ('Gaming', 'gaming', 'Video games, consoles, and esports', 5),
      ('Politics & News', 'politics-news', 'Current events, policy, and world affairs', 6),
      ('Food & Drink', 'food', 'Restaurants, recipes, cuisines, and beverages', 7),
      ('Culture', 'culture', 'Art, books, fashion, and lifestyle', 8),
      ('Other', 'other', 'Everything else that deserves a rating', 9)
    ON CONFLICT DO NOTHING
  `);
  await db.execute(sql`
    INSERT INTO users (clerk_id, username, email, is_admin) VALUES
      ('user_test_regular', 'reguser', 'reg@test.dev', false),
      ('user_test_admin', 'adminuser', 'admin@test.dev', true)
    ON CONFLICT DO NOTHING
  `);
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Creates a topic with N options, returns topicId + optionIds (sorted) */
async function createTopicWithOptions(
  caller: Awaited<ReturnType<typeof createTestCaller>>,
  title: string,
  numOptions = 4
) {
  const opts = Array.from({ length: numOptions }, (_, i) => ({
    name: `${title} Option ${i + 1}`,
  }));
  const { id: topicId } = await caller.topics.create({
    title,
    categoryId: 1,
    options: opts,
  });
  const createdOptions = await db
    .select({ id: options.id, name: options.name })
    .from(options)
    .where(eq(options.topicId, topicId))
    .orderBy(options.id);
  return { topicId, optionIds: createdOptions.map((o) => o.id) };
}

// ─── getPair ──────────────────────────────────────────────────────────────────

describe("arena.getPair", () => {
  it("returns two distinct options for a topic with 2+ options", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { topicId } = await createTopicWithOptions(caller, "Arena Pair Test");

    const result = await caller.arena.getPair({ topicId });

    expect(result.insufficientOptions).toBe(false);
    expect(result.optionA).not.toBeNull();
    expect(result.optionB).not.toBeNull();
    expect(result.optionA!.id).not.toBe(result.optionB!.id);
    // Canonical ordering: optionA.id < optionB.id
    expect(result.optionA!.id < result.optionB!.id).toBe(true);
  });

  it("returns insufficientOptions for fewer than 2 options", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    // topics.create requires min 2 options, so create with 2 then delete one
    const { id: topicId } = await caller.topics.create({
      title: "One Option Topic",
      categoryId: 1,
      options: [{ name: "Option A" }, { name: "Option B" }],
    });

    // Delete one option to get below the threshold
    const topicOpts = await db
      .select({ id: options.id })
      .from(options)
      .where(eq(options.topicId, topicId));
    await db.execute(sql`DELETE FROM options WHERE id = ${topicOpts[0].id}`);

    const result = await caller.arena.getPair({ topicId });

    expect(result.insufficientOptions).toBe(true);
    expect(result.optionA).toBeNull();
    expect(result.optionB).toBeNull();
  });

  it("initializes Elo stats on first call (idempotent)", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { topicId, optionIds } = await createTopicWithOptions(caller, "Init Test", 3);

    // First call initializes
    await caller.arena.getPair({ topicId });

    const stats = await db
      .select({ optionId: optionEloStats.optionId, eloRating: optionEloStats.eloRating })
      .from(optionEloStats)
      .where(eq(optionEloStats.topicId, topicId));

    expect(stats.length).toBe(3);
    for (const s of stats) {
      expect(s.eloRating).toBe(ELO_INITIAL);
    }

    // Second call is idempotent — no error, same count
    await caller.arena.getPair({ topicId });
    const stats2 = await db
      .select({ optionId: optionEloStats.optionId })
      .from(optionEloStats)
      .where(eq(optionEloStats.topicId, topicId));
    expect(stats2.length).toBe(3);
  });
});

// ─── vote ─────────────────────────────────────────────────────────────────────

describe("arena.vote", () => {
  it("updates Elo correctly (K=32 formula verification)", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { topicId, optionIds } = await createTopicWithOptions(caller, "Elo Formula Test", 2);

    // Initialize Elo
    await caller.arena.getPair({ topicId });

    const [optA, optB] = optionIds.sort();
    const result = await caller.arena.vote({
      topicId,
      optionAId: optA,
      optionBId: optB,
      winnerOptionId: optA,
    });

    // Verify against pure Elo calculation
    const expected = calculateElo(ELO_INITIAL, ELO_INITIAL, "a");
    expect(result.newEloA).toBe(expected.newRatingA);
    expect(result.newEloB).toBe(expected.newRatingB);
  });

  it("increments match/win/loss counts correctly", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { topicId, optionIds } = await createTopicWithOptions(caller, "Count Test", 2);
    await caller.arena.getPair({ topicId });

    const [optA, optB] = optionIds.sort();
    await caller.arena.vote({
      topicId, optionAId: optA, optionBId: optB, winnerOptionId: optA,
    });

    const statsA = await db
      .select({ matchCount: optionEloStats.matchCount, winCount: optionEloStats.winCount, lossCount: optionEloStats.lossCount })
      .from(optionEloStats)
      .where(and(eq(optionEloStats.topicId, topicId), eq(optionEloStats.optionId, optA)))
      .limit(1);

    expect(statsA[0].matchCount).toBe(1);
    expect(statsA[0].winCount).toBe(1);
    expect(statsA[0].lossCount).toBe(0);

    const statsB = await db
      .select({ matchCount: optionEloStats.matchCount, winCount: optionEloStats.winCount, lossCount: optionEloStats.lossCount })
      .from(optionEloStats)
      .where(and(eq(optionEloStats.topicId, topicId), eq(optionEloStats.optionId, optB)))
      .limit(1);

    expect(statsB[0].matchCount).toBe(1);
    expect(statsB[0].winCount).toBe(0);
    expect(statsB[0].lossCount).toBe(1);
  });

  it("is concurrency-safe (parallel votes do not corrupt Elo)", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { topicId, optionIds } = await createTopicWithOptions(caller, "Concurrency Test", 2);
    await caller.arena.getPair({ topicId });

    const [optA, optB] = optionIds.sort();

    // Fire 5 parallel votes (different fingerprints = different voters, bypasses UNIQUE)
    const promises = Array.from({ length: 5 }, (_, i) =>
      createTestCaller(null).then((guestCaller) =>
        guestCaller.arena.vote({
          topicId,
          optionAId: optA,
          optionBId: optB,
          winnerOptionId: optA,
          guestFingerprint: `concurrent-guest-${i}`,
        })
      )
    );

    const results = await Promise.allSettled(promises);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    // All 5 should succeed (different voters — no UNIQUE collision)
    expect(fulfilled.length).toBe(5);

    // Verify match counts add up
    const stats = await db
      .select({ matchCount: optionEloStats.matchCount })
      .from(optionEloStats)
      .where(and(eq(optionEloStats.topicId, topicId), eq(optionEloStats.optionId, optA)))
      .limit(1);

    expect(stats[0].matchCount).toBe(5);

    // Zero-sum: total Elo should be 2 * 1500 = 3000
    const allStats = await db
      .select({ eloRating: optionEloStats.eloRating })
      .from(optionEloStats)
      .where(eq(optionEloStats.topicId, topicId));
    const totalElo = allStats.reduce((sum, s) => sum + s.eloRating, 0);
    expect(Math.abs(totalElo - 3000)).toBeLessThan(0.1);
  });

  it("rejects duplicate vote on same pair (idempotent no-op via UNIQUE)", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { topicId, optionIds } = await createTopicWithOptions(caller, "Dedup Test", 2);
    await caller.arena.getPair({ topicId });

    const [optA, optB] = optionIds.sort();

    // First vote succeeds
    const first = await caller.arena.vote({
      topicId, optionAId: optA, optionBId: optB, winnerOptionId: optA,
    });
    expect(first.matchId).toBeDefined();

    // Second vote on same pair returns alreadyVoted (idempotent no-op)
    const second = await caller.arena.vote({
      topicId, optionAId: optA, optionBId: optB, winnerOptionId: optB,
    });
    expect((second as { alreadyVoted?: boolean }).alreadyVoted).toBe(true);

    // Elo was only applied once
    const statsA = await db
      .select({ matchCount: optionEloStats.matchCount })
      .from(optionEloStats)
      .where(and(eq(optionEloStats.topicId, topicId), eq(optionEloStats.optionId, optA)))
      .limit(1);
    expect(statsA[0].matchCount).toBe(1);
  });

  it("vote with swapped option order is canonicalized (A>B becomes B,A)", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { topicId, optionIds } = await createTopicWithOptions(caller, "Order Test", 2);
    await caller.arena.getPair({ topicId });

    const [optA, optB] = optionIds.sort(); // optA < optB

    // Send with reversed order (optB first)
    const result = await caller.arena.vote({
      topicId, optionAId: optB, optionBId: optA, winnerOptionId: optB,
    });
    expect(result.matchId).toBeDefined();

    // Verify stored in canonical order
    const [vote] = await db
      .select({ optionAId: arenaVotes.optionAId, optionBId: arenaVotes.optionBId })
      .from(arenaVotes)
      .where(eq(arenaVotes.topicId, topicId))
      .limit(1);
    expect(vote.optionAId).toBe(optA); // canonical order
    expect(vote.optionBId).toBe(optB);

    // Second vote with correct order → duplicate detected via UNIQUE
    const second = await caller.arena.vote({
      topicId, optionAId: optA, optionBId: optB, winnerOptionId: optA,
    });
    expect((second as { alreadyVoted?: boolean }).alreadyVoted).toBe(true);
  });

  it("works for guest with fingerprint (atomic upsert creates guest)", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { topicId, optionIds } = await createTopicWithOptions(caller, "Guest Vote Test", 2);
    await caller.arena.getPair({ topicId });

    const guestCaller = await createTestCaller(null);
    const [optA, optB] = optionIds.sort();

    const result = await guestCaller.arena.vote({
      topicId,
      optionAId: optA,
      optionBId: optB,
      winnerOptionId: optA,
      guestFingerprint: "test-guest-fingerprint-123",
    });

    expect(result.matchId).toBeDefined();
    expect(result.newEloA).toBeGreaterThan(ELO_INITIAL);
  });

  it("fails without auth or fingerprint (BAD_REQUEST)", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { topicId, optionIds } = await createTopicWithOptions(caller, "No Auth Test", 2);
    await caller.arena.getPair({ topicId });

    const anonCaller = await createTestCaller(null);
    const [optA, optB] = optionIds.sort();

    await expect(
      anonCaller.arena.vote({
        topicId,
        optionAId: optA,
        optionBId: optB,
        winnerOptionId: optA,
        // No guestFingerprint provided
      })
    ).rejects.toThrow("Authentication or guest fingerprint required");
  });

  it("enforces guest per-topic cap (max 20 arena votes per topic)", async () => {
    // Need 20 unique (guest, pair) combinations.
    // C(7,2) = 21 unique pairs from 7 options - enough for 20 votes + 1 rejected.
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { topicId, optionIds } = await createTopicWithOptions(caller, "Guest Limit Test", 7);
    await caller.arena.getPair({ topicId });

    const fingerprint = "rate-limit-guest-fp";
    const sortedIds = [...optionIds].sort();

    // Generate all unique pairs (sorted for canonical order)
    const pairs: [string, string][] = [];
    for (let i = 0; i < sortedIds.length; i++) {
      for (let j = i + 1; j < sortedIds.length; j++) {
        pairs.push([sortedIds[i], sortedIds[j]]);
      }
    }

    // Vote on 20 different pairs as the same guest
    const guestCaller = await createTestCaller(null);
    for (let i = 0; i < 20; i++) {
      await guestCaller.arena.vote({
        topicId,
        optionAId: pairs[i][0],
        optionBId: pairs[i][1],
        winnerOptionId: pairs[i][0],
        guestFingerprint: fingerprint,
      });
    }

    // 21st vote should be rejected by per-topic cap
    await expect(
      guestCaller.arena.vote({
        topicId,
        optionAId: pairs[20][0],
        optionBId: pairs[20][1],
        winnerOptionId: pairs[20][0],
        guestFingerprint: fingerprint,
      })
    ).rejects.toThrow("Guests can cast up to 20 arena votes per topic");
  });

  it("rejects winner not in pair (BAD_REQUEST)", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { topicId, optionIds } = await createTopicWithOptions(caller, "Bad Winner Test", 3);
    await caller.arena.getPair({ topicId });

    const sorted = [...optionIds].sort();

    await expect(
      caller.arena.vote({
        topicId,
        optionAId: sorted[0],
        optionBId: sorted[1],
        winnerOptionId: sorted[2], // Not in the pair!
      })
    ).rejects.toThrow("winnerOptionId must be one of the two options in the pair");
  });

  it("rejects options from different topics (S4 validation)", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { topicId: topicId1, optionIds: opts1 } = await createTopicWithOptions(caller, "Topic A", 2);
    const { topicId: topicId2, optionIds: opts2 } = await createTopicWithOptions(caller, "Topic B", 2);

    await caller.arena.getPair({ topicId: topicId1 });

    // Try to vote with an option from topic B against topic A
    const sorted1 = [...opts1].sort();
    const sorted2 = [...opts2].sort();

    await expect(
      caller.arena.vote({
        topicId: topicId1,
        optionAId: sorted1[0],
        optionBId: sorted2[0], // from different topic!
        winnerOptionId: sorted1[0],
      })
    ).rejects.toThrow("Both options must belong to the specified topic");
  });

  it("concurrent guest creation with same fingerprint produces single guest", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { topicId, optionIds } = await createTopicWithOptions(caller, "Concurrent Guest Test", 4);
    await caller.arena.getPair({ topicId });

    const sorted = [...optionIds].sort();
    const fingerprint = "concurrent-same-fingerprint";

    // Fire 3 parallel votes with the same fingerprint but different pairs
    const promises = [
      createTestCaller(null).then((c) =>
        c.arena.vote({
          topicId, optionAId: sorted[0], optionBId: sorted[1],
          winnerOptionId: sorted[0], guestFingerprint: fingerprint,
        })
      ),
      createTestCaller(null).then((c) =>
        c.arena.vote({
          topicId, optionAId: sorted[0], optionBId: sorted[2],
          winnerOptionId: sorted[0], guestFingerprint: fingerprint,
        })
      ),
      createTestCaller(null).then((c) =>
        c.arena.vote({
          topicId, optionAId: sorted[0], optionBId: sorted[3],
          winnerOptionId: sorted[0], guestFingerprint: fingerprint,
        })
      ),
    ];

    const results = await Promise.allSettled(promises);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    expect(fulfilled.length).toBeGreaterThan(0);

    // Verify only one guest record was created
    const guestRows = await db.execute<{ cnt: number }>(sql`
      SELECT COUNT(*)::int AS cnt FROM guests WHERE fingerprint_hash = ${fingerprint}
    `);
    expect(guestRows[0].cnt).toBe(1);
  });
});

// ─── skip ─────────────────────────────────────────────────────────────────────

describe("arena.skip", () => {
  it("records event log row with winner=NULL, no Elo change", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { topicId, optionIds } = await createTopicWithOptions(caller, "Skip Test", 2);
    await caller.arena.getPair({ topicId });

    const [optA, optB] = optionIds.sort();
    const result = await caller.arena.skip({
      topicId, optionAId: optA, optionBId: optB,
    });

    expect(result.skipped).toBe(true);

    // Verify event log has winner = NULL
    const [vote] = await db
      .select({ winnerOptionId: arenaVotes.winnerOptionId, eloAAfter: arenaVotes.eloAAfter })
      .from(arenaVotes)
      .where(eq(arenaVotes.id, result.matchId))
      .limit(1);

    expect(vote.winnerOptionId).toBeNull();
    // Elo unchanged
    expect(vote.eloAAfter).toBe(ELO_INITIAL);

    // Verify cached stats unchanged
    const statsA = await db
      .select({ matchCount: optionEloStats.matchCount, eloRating: optionEloStats.eloRating })
      .from(optionEloStats)
      .where(and(eq(optionEloStats.topicId, topicId), eq(optionEloStats.optionId, optA)))
      .limit(1);

    expect(statsA[0].matchCount).toBe(0); // Skip doesn't count as a match
    expect(statsA[0].eloRating).toBe(ELO_INITIAL);
  });
});

// ─── getLeaderboard ───────────────────────────────────────────────────────────

describe("arena.getLeaderboard", () => {
  it("returns options sorted by Elo DESC", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { topicId, optionIds } = await createTopicWithOptions(caller, "Leaderboard Test", 3);
    await caller.arena.getPair({ topicId });

    const sorted = [...optionIds].sort();
    // Vote: sorted[0] beats sorted[1]
    await caller.arena.vote({
      topicId, optionAId: sorted[0], optionBId: sorted[1], winnerOptionId: sorted[0],
    });

    const leaderboard = await caller.arena.getLeaderboard({ topicId });

    expect(leaderboard.entries.length).toBe(3);
    // First entry should be the winner (highest Elo)
    expect(leaderboard.entries[0].optionId).toBe(sorted[0]);
    // Entries are sorted descending by Elo
    for (let i = 1; i < leaderboard.entries.length; i++) {
      expect(leaderboard.entries[i - 1].eloRating).toBeGreaterThanOrEqual(
        leaderboard.entries[i].eloRating
      );
    }
  });

  it("shows correct win percentage", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { topicId, optionIds } = await createTopicWithOptions(caller, "Win% Test", 2);
    await caller.arena.getPair({ topicId });

    const sorted = [...optionIds].sort();

    // 2 votes: A wins both (different voters to bypass UNIQUE)
    await caller.arena.vote({
      topicId, optionAId: sorted[0], optionBId: sorted[1], winnerOptionId: sorted[0],
    });

    const guest1 = await createTestCaller(null);
    await guest1.arena.vote({
      topicId, optionAId: sorted[0], optionBId: sorted[1], winnerOptionId: sorted[0],
      guestFingerprint: "win-pct-guest-1",
    });

    const leaderboard = await caller.arena.getLeaderboard({ topicId });
    const winnerEntry = leaderboard.entries.find((e) => e.optionId === sorted[0])!;
    const loserEntry = leaderboard.entries.find((e) => e.optionId === sorted[1])!;

    expect(winnerEntry.winPercentage).toBe(100);
    expect(loserEntry.winPercentage).toBe(0);
    expect(winnerEntry.matchCount).toBe(2);
  });

  it("Elo zero-sum: total Elo delta across all options = 0", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { topicId, optionIds } = await createTopicWithOptions(caller, "Zero Sum Test", 4);
    await caller.arena.getPair({ topicId });

    const sorted = [...optionIds].sort();

    // Multiple votes between different pairs
    await caller.arena.vote({
      topicId, optionAId: sorted[0], optionBId: sorted[1], winnerOptionId: sorted[0],
    });

    const guest1 = await createTestCaller(null);
    await guest1.arena.vote({
      topicId, optionAId: sorted[2], optionBId: sorted[3], winnerOptionId: sorted[2],
      guestFingerprint: "zero-sum-guest-1",
    });

    const guest2 = await createTestCaller(null);
    await guest2.arena.vote({
      topicId, optionAId: sorted[0], optionBId: sorted[2], winnerOptionId: sorted[2],
      guestFingerprint: "zero-sum-guest-2",
    });

    const leaderboard = await caller.arena.getLeaderboard({ topicId });
    const totalElo = leaderboard.entries.reduce((sum, e) => sum + e.eloRating, 0);
    const expectedTotal = optionIds.length * ELO_INITIAL; // 4 * 1500 = 6000

    // Allow small floating-point drift from real storage
    expect(Math.abs(totalElo - expectedTotal)).toBeLessThan(0.1);
  });

  it("pair selection favors least-compared options (cold-start fairness)", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const { topicId, optionIds } = await createTopicWithOptions(caller, "Fairness Test", 5);
    await caller.arena.getPair({ topicId });

    const sorted = [...optionIds].sort();

    // Give sorted[0] and sorted[1] high match counts by voting several times
    for (let i = 0; i < 5; i++) {
      const guestCaller = await createTestCaller(null);
      await guestCaller.arena.vote({
        topicId, optionAId: sorted[0], optionBId: sorted[1], winnerOptionId: sorted[0],
        guestFingerprint: `fairness-guest-${i}`,
      });
    }

    // Now getPair should prefer options with low match counts (sorted[2], sorted[3], sorted[4])
    // Run multiple times and track which options appear
    const appearances = new Map<string, number>();
    for (let i = 0; i < 20; i++) {
      const pair = await caller.arena.getPair({ topicId });
      if (!pair.insufficientOptions) {
        appearances.set(pair.optionA!.id, (appearances.get(pair.optionA!.id) ?? 0) + 1);
        appearances.set(pair.optionB!.id, (appearances.get(pair.optionB!.id) ?? 0) + 1);
      }
    }

    // Options with 0 matches (sorted[2,3,4]) should appear more often than
    // options with 5 matches (sorted[0,1])
    const lowMatchAppearances = (appearances.get(sorted[2]) ?? 0) +
      (appearances.get(sorted[3]) ?? 0) + (appearances.get(sorted[4]) ?? 0);
    const highMatchAppearances = (appearances.get(sorted[0]) ?? 0) +
      (appearances.get(sorted[1]) ?? 0);

    expect(lowMatchAppearances).toBeGreaterThan(highMatchAppearances);
  });
});
