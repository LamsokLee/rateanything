/**
 * Arena router — pairwise comparison voting with Elo rankings.
 *
 * Procedures:
 *   getPair       — returns two options for head-to-head comparison
 *   vote          — records a vote with atomic Elo update in a transaction
 *   skip          — records a skip (no Elo change)
 *   getLeaderboard — returns options sorted by Elo rating
 *
 * Key invariants:
 *   - Pairs are stored in canonical order: option_a_id < option_b_id (DB CHECK enforced)
 *   - elo_*_before values come from the transactional FOR UPDATE read, never client input
 *   - Deadlock prevention: rows locked in option_id ASC order
 *   - Duplicate prevention: UNIQUE constraint on (topic, voter, pair) — no TOCTOU races
 *   - Elo computed BEFORE insert: if unique_violation fires, Elo is never applied
 *   - arena_votes is immutable event log; option_elo_stats is derived cache
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../trpc";
import { rateLimit } from "../rate-limit";
import { calculateElo, ELO_INITIAL } from "@/lib/elo";
import {
  db, options, users, guests, arenaVotes, optionEloStats,
  eq, and, sql, desc, asc, inArray,
} from "@rateanything/db";

/** Max arena votes per topic for guests (Layer 2 rate limit) */
const GUEST_TOPIC_CAP = 20;
/** Max arena votes per topic for authenticated users (Layer 2 rate limit) */
const AUTH_TOPIC_CAP = 200;

export const arenaRouter = router({
  /**
   * getPair — returns two options for a topic for head-to-head comparison.
   *
   * Pair selection uses "least-compared" weighting for cold-start fairness:
   * selects from options with matchCount <= min + 2, then picks 2 randomly.
   * Initializes Elo stats on first call (idempotent via ON CONFLICT DO NOTHING).
   */
  getPair: publicProcedure
    .use(rateLimit("arena.getPair", 60, 60))
    .input(z.object({
      topicId: z.string().uuid(),
    }))
    .query(async ({ input }) => {
      const { topicId } = input;

      // Fetch all options for the topic
      const topicOptions = await db
        .select({ id: options.id, name: options.name, imageUrl: options.imageUrl })
        .from(options)
        .where(eq(options.topicId, topicId))
        .orderBy(asc(options.id));

      if (topicOptions.length < 2) {
        return { insufficientOptions: true as const, optionA: null, optionB: null };
      }

      // Bulk-initialize Elo stats for all options in this topic (idempotent).
      // ON CONFLICT DO NOTHING makes this safe for concurrent calls.
      await db
        .insert(optionEloStats)
        .values(
          topicOptions.map((opt) => ({
            topicId,
            optionId: opt.id,
            eloRating: ELO_INITIAL,
            matchCount: 0,
            winCount: 0,
            lossCount: 0,
          }))
        )
        .onConflictDoNothing({ target: [optionEloStats.topicId, optionEloStats.optionId] });

      // Re-query all stats after upsert to handle concurrent initialization
      const allStats = await db
        .select({
          optionId: optionEloStats.optionId,
          eloRating: optionEloStats.eloRating,
          matchCount: optionEloStats.matchCount,
        })
        .from(optionEloStats)
        .where(eq(optionEloStats.topicId, topicId));

      // Cold-start fairness: find minimum matchCount, select from pool within min + 2
      const minMatchCount = Math.min(...allStats.map((s) => s.matchCount));
      const pool = allStats.filter((s) => s.matchCount <= minMatchCount + 2);

      // Randomly select 2 distinct options from the pool
      // Fisher-Yates partial shuffle for 2 elements
      const shuffled = [...pool];
      for (let i = shuffled.length - 1; i > shuffled.length - 3 && i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      const selected = shuffled.slice(-2);

      // Canonical ordering in response: optionA.id < optionB.id (deterministic dedup)
      selected.sort((a, b) => a.optionId.localeCompare(b.optionId));

      const optionMap = new Map(topicOptions.map((o) => [o.id, o]));

      return {
        insufficientOptions: false as const,
        optionA: {
          id: selected[0].optionId,
          name: optionMap.get(selected[0].optionId)!.name,
          imageUrl: optionMap.get(selected[0].optionId)!.imageUrl,
          eloRating: selected[0].eloRating,
          matchCount: selected[0].matchCount,
        },
        optionB: {
          id: selected[1].optionId,
          name: optionMap.get(selected[1].optionId)!.name,
          imageUrl: optionMap.get(selected[1].optionId)!.imageUrl,
          eloRating: selected[1].eloRating,
          matchCount: selected[1].matchCount,
        },
      };
    }),

  /**
   * vote — records a pairwise comparison vote with atomic Elo update.
   *
   * Transaction steps (plan sections 2, 13):
   *   1. Canonicalize pair order (lowercase-normalize UUIDs, ensure A < B)
   *   2. Pre-tx validation: winner-in-pair (S3), same-topic (S4)
   *   3. Inside tx: resolve voter (atomic guest upsert), ensure Elo rows,
   *      lock FOR UPDATE in option_id ASC order (deadlock prevention),
   *      per-topic cap check, compute Elo, INSERT vote (UNIQUE dedup),
   *      apply Elo updates.
   *
   * Key: Elo is computed BEFORE the INSERT. If INSERT raises unique_violation
   * (23505), the catch returns early WITHOUT applying Elo UPDATEs.
   */
  vote: publicProcedure
    .use(rateLimit("arena.vote", 30, 60))
    .input(z.object({
      topicId: z.string().uuid(),
      optionAId: z.string().uuid(),
      optionBId: z.string().uuid(),
      winnerOptionId: z.string().uuid(),
      guestFingerprint: z.string().max(64).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { topicId, winnerOptionId, guestFingerprint } = input;

      // ── PRE-TRANSACTION: Canonicalize pair order ──
      // Lowercase-normalize UUIDs to match the PG text CHECK constraint.
      // Swap if needed — the winner stays the same regardless of order.
      const normalizedA = input.optionAId.toLowerCase();
      const normalizedB = input.optionBId.toLowerCase();
      const [canonA, canonB] = normalizedA < normalizedB
        ? [normalizedA, normalizedB]
        : [normalizedB, normalizedA];
      const normalizedWinner = winnerOptionId.toLowerCase();

      // Validate: options must be different
      if (canonA === canonB) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot vote on the same option against itself",
        });
      }

      // Validate: winner must be one of the pair (S3 server-side check)
      if (normalizedWinner !== canonA && normalizedWinner !== canonB) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "winnerOptionId must be one of the two options in the pair",
        });
      }

      // ── PRE-TRANSACTION: Same-topic validation (S4) ──
      // Verify both options belong to the specified topic
      const optionRows = await db
        .select({ id: options.id })
        .from(options)
        .where(and(
          inArray(options.id, [canonA, canonB]),
          eq(options.topicId, topicId)
        ));

      if (optionRows.length !== 2) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Both options must belong to the specified topic",
        });
      }

      // ── TRANSACTION: Atomic vote + Elo update ──
      const result = await db.transaction(async (tx) => {
        // Step 1: RESOLVE VOTER IDENTITY
        // Guest upsert is INSIDE the transaction (B2 resolution) to prevent
        // race conditions where concurrent first-votes create duplicate guests.
        let userId: string | null = null;
        let guestId: string | null = null;

        if (ctx.auth?.userId) {
          const [user] = await tx
            .select({ id: users.id })
            .from(users)
            .where(eq(users.clerkId, ctx.auth.userId))
            .limit(1);

          if (!user) {
            throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
          }
          userId = user.id;
        } else if (guestFingerprint) {
          // Atomic upsert: INSERT ... ON CONFLICT DO NOTHING + re-SELECT
          // Safe under concurrent first-votes: UNIQUE on fingerprint_hash prevents dupes.
          await tx.execute(sql`
            INSERT INTO guests (fingerprint_hash)
            VALUES (${guestFingerprint})
            ON CONFLICT (fingerprint_hash) DO NOTHING
          `);
          const [guest] = await tx
            .select({ id: guests.id })
            .from(guests)
            .where(eq(guests.fingerprintHash, guestFingerprint))
            .limit(1);
          guestId = guest.id;
        } else {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Authentication or guest fingerprint required",
          });
        }

        // Step 2: ENSURE option_elo_stats ROWS EXIST (B3 resolution)
        // Guarantees rows exist before FOR UPDATE lock, prevents "zero rows" failure.
        await tx.execute(sql`
          INSERT INTO option_elo_stats (topic_id, option_id, elo_rating, match_count, win_count, loss_count)
          VALUES (${topicId}, ${canonA}, 1500, 0, 0, 0),
                 (${topicId}, ${canonB}, 1500, 0, 0, 0)
          ON CONFLICT (topic_id, option_id) DO NOTHING
        `);

        // Step 3: LOCK ELO ROWS — deterministic order by option_id ASC prevents deadlocks (B3).
        // Because canonA < canonB (by construction), ORDER BY option_id ASC always
        // produces the same acquisition order regardless of which pair is being voted on.
        // Any two transactions that share at least one option will lock in the same
        // relative order, preventing circular waits.
        const lockedRows = await tx.execute<{
          option_id: string;
          elo_rating: number;
          match_count: number;
          win_count: number;
          loss_count: number;
        }>(sql`
          SELECT option_id, elo_rating, match_count, win_count, loss_count
          FROM option_elo_stats
          WHERE topic_id = ${topicId} AND option_id IN (${canonA}, ${canonB})
          ORDER BY option_id ASC
          FOR UPDATE
        `);

        if (lockedRows.length !== 2) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Elo stats not found for one or both options",
          });
        }

        // Find A and B stats from locked rows (already sorted by option_id ASC)
        const statsA = lockedRows.find((r) => r.option_id === canonA)!;
        const statsB = lockedRows.find((r) => r.option_id === canonB)!;

        // Step 4: PER-TOPIC VOTE CAP (Layer 2 rate limit — defense in depth)
        // Prevents a single logical identity from monopolizing Elo within a topic.
        const cap = userId ? AUTH_TOPIC_CAP : GUEST_TOPIC_CAP;
        const voterCondition = userId
          ? sql`user_id = ${userId}`
          : sql`guest_id = ${guestId}`;

        const [countResult] = await tx.execute<{ cnt: number }>(sql`
          SELECT COUNT(*)::int AS cnt FROM arena_votes
          WHERE topic_id = ${topicId} AND ${voterCondition}
        `);

        if ((countResult?.cnt ?? 0) >= cap) {
          const message = userId
            ? "Vote limit reached for this topic (max 200)"
            : "Guests can cast up to 20 arena votes per topic. Sign in to vote more!";
          throw new TRPCError({ code: "FORBIDDEN", message });
        }

        // Step 5: COMPUTE ELO BEFORE INSERT (key invariant)
        // If the INSERT returns 0 rows (duplicate), Elo UPDATEs are skipped.
        const winner = normalizedWinner === canonA ? "a" : "b";
        const { newRatingA, newRatingB } = calculateElo(
          statsA.elo_rating,
          statsB.elo_rating,
          winner
        );

        // Step 6: INSERT VOTE — use ON CONFLICT DO NOTHING for duplicate detection.
        // If the voter already voted on this exact pair, no row is returned (0 rows).
        // This avoids raising a PostgresError inside the transaction (which would abort it
        // in postgres.js since transactions can't recover from errors).
        const insertedRows = await tx.execute<{ id: string }>(sql`
          INSERT INTO arena_votes (topic_id, option_a_id, option_b_id, winner_option_id, user_id, guest_id, elo_a_before, elo_b_before, elo_a_after, elo_b_after)
          VALUES (${topicId}, ${canonA}, ${canonB}, ${normalizedWinner}, ${userId}, ${guestId}, ${statsA.elo_rating}, ${statsB.elo_rating}, ${newRatingA}, ${newRatingB})
          ON CONFLICT DO NOTHING
          RETURNING id
        `);

        if (insertedRows.length === 0) {
          // Duplicate vote detected (idempotent no-op). Elo applied exactly once.
          return {
            alreadyVoted: true as const,
            matchId: null,
            newEloA: statsA.elo_rating,
            newEloB: statsB.elo_rating,
          };
        }

        // Step 7: APPLY ELO — only reached if INSERT succeeded (Elo applied exactly once)
        await tx.execute(sql`
          UPDATE option_elo_stats
          SET elo_rating = ${newRatingA},
              match_count = match_count + 1,
              win_count = win_count + ${winner === "a" ? 1 : 0},
              loss_count = loss_count + ${winner === "a" ? 0 : 1},
              updated_at = NOW()
          WHERE topic_id = ${topicId} AND option_id = ${canonA}
        `);

        await tx.execute(sql`
          UPDATE option_elo_stats
          SET elo_rating = ${newRatingB},
              match_count = match_count + 1,
              win_count = win_count + ${winner === "b" ? 1 : 0},
              loss_count = loss_count + ${winner === "b" ? 0 : 1},
              updated_at = NOW()
          WHERE topic_id = ${topicId} AND option_id = ${canonB}
        `);

        return { matchId: insertedRows[0].id, newEloA: newRatingA, newEloB: newRatingB };
      });

      return result;
    }),

  /**
   * skip — records a skip event (no Elo change).
   * Stores a vote row with winner_option_id = NULL and unchanged Elo values.
   * Uses the same canonical ordering and voter resolution as vote.
   */
  skip: publicProcedure
    .use(rateLimit("arena.skip", 30, 60))
    .input(z.object({
      topicId: z.string().uuid(),
      optionAId: z.string().uuid(),
      optionBId: z.string().uuid(),
      guestFingerprint: z.string().max(64).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { topicId, guestFingerprint } = input;

      // Canonicalize pair order (lowercase-normalize)
      const normalizedA = input.optionAId.toLowerCase();
      const normalizedB = input.optionBId.toLowerCase();
      const [canonA, canonB] = normalizedA < normalizedB
        ? [normalizedA, normalizedB]
        : [normalizedB, normalizedA];

      // Resolve voter identity
      let userId: string | null = null;
      let guestId: string | null = null;

      if (ctx.auth?.userId) {
        const [user] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.clerkId, ctx.auth.userId))
          .limit(1);

        if (!user) {
          throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
        }
        userId = user.id;
      } else if (guestFingerprint) {
        // Atomic guest upsert (same pattern as vote)
        await db.execute(sql`
          INSERT INTO guests (fingerprint_hash)
          VALUES (${guestFingerprint})
          ON CONFLICT (fingerprint_hash) DO NOTHING
        `);
        const [guest] = await db
          .select({ id: guests.id })
          .from(guests)
          .where(eq(guests.fingerprintHash, guestFingerprint))
          .limit(1);
        guestId = guest.id;
      } else {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Authentication or guest fingerprint required",
        });
      }

      // Read current Elo values (no lock needed — skip doesn't change Elo)
      const stats = await db
        .select({ optionId: optionEloStats.optionId, eloRating: optionEloStats.eloRating })
        .from(optionEloStats)
        .where(
          and(
            eq(optionEloStats.topicId, topicId),
            inArray(optionEloStats.optionId, [canonA, canonB])
          )
        );

      const eloA = stats.find((s) => s.optionId === canonA)?.eloRating ?? ELO_INITIAL;
      const eloB = stats.find((s) => s.optionId === canonB)?.eloRating ?? ELO_INITIAL;

      // Insert skip event (winner_option_id = NULL, Elo unchanged)
      const [vote] = await db
        .insert(arenaVotes)
        .values({
          topicId,
          optionAId: canonA,
          optionBId: canonB,
          winnerOptionId: null,
          userId,
          guestId,
          eloABefore: eloA,
          eloBBefore: eloB,
          eloAAfter: eloA,
          eloBAfter: eloB,
        })
        .returning({ id: arenaVotes.id });

      return { matchId: vote.id, skipped: true };
    }),

  /**
   * getLeaderboard — returns all options for a topic sorted by Elo desc.
   * Includes match count, win/loss stats, and win percentage.
   * No rate limiting (read-only, cacheable).
   */
  getLeaderboard: publicProcedure
    .input(z.object({
      topicId: z.string().uuid(),
    }))
    .query(async ({ input }) => {
      const { topicId } = input;

      const stats = await db
        .select({
          optionId: optionEloStats.optionId,
          eloRating: optionEloStats.eloRating,
          matchCount: optionEloStats.matchCount,
          winCount: optionEloStats.winCount,
          lossCount: optionEloStats.lossCount,
        })
        .from(optionEloStats)
        .where(eq(optionEloStats.topicId, topicId))
        .orderBy(desc(optionEloStats.eloRating));

      if (stats.length === 0) {
        return { entries: [], totalVotes: 0 };
      }

      // Fetch option names/images for display
      const optionIds = stats.map((s) => s.optionId);
      const optionDetails = await db
        .select({ id: options.id, name: options.name, imageUrl: options.imageUrl })
        .from(options)
        .where(inArray(options.id, optionIds));

      const optionMap = new Map(optionDetails.map((o) => [o.id, o]));

      const entries = stats.map((s, idx) => ({
        rank: idx + 1,
        optionId: s.optionId,
        name: optionMap.get(s.optionId)?.name ?? "Unknown",
        imageUrl: optionMap.get(s.optionId)?.imageUrl ?? null,
        eloRating: s.eloRating,
        matchCount: s.matchCount,
        winCount: s.winCount,
        lossCount: s.lossCount,
        winPercentage: s.matchCount > 0
          ? Math.round((s.winCount / s.matchCount) * 100)
          : 0,
      }));

      // Total votes = sum of matchCounts / 2 (each vote involves 2 options)
      const totalVotes = Math.floor(
        stats.reduce((sum, s) => sum + s.matchCount, 0) / 2
      );

      return { entries, totalVotes };
    }),
});
