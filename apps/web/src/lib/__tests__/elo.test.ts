/**
 * Unit tests for the Elo rating calculation utility.
 * Verifies K-factor, zero-sum property, and expected outcomes.
 */
import { describe, it, expect } from "vitest";
import { calculateElo, ELO_K_FACTOR, ELO_INITIAL } from "@/lib/elo";

describe("calculateElo", () => {
  it("uses K-factor of 32", () => {
    expect(ELO_K_FACTOR).toBe(32);
  });

  it("equal ratings: winner gains ~16, loser loses ~16", () => {
    const { newRatingA, newRatingB } = calculateElo(1500, 1500, "a");

    // With equal ratings, expected score is 0.5 for each
    // Winner gain: K * (1 - 0.5) = 32 * 0.5 = 16
    expect(newRatingA).toBe(1516);
    expect(newRatingB).toBe(1484);
  });

  it("higher-rated beats lower: small gain (expected outcome)", () => {
    // A is much higher rated — beating B is expected, small reward
    const { newRatingA, newRatingB } = calculateElo(1800, 1200, "a");

    // A's expected score is very high (~0.97), so gain is small
    expect(newRatingA).toBeGreaterThan(1800);
    expect(newRatingA).toBeLessThan(1802); // Gain < 2 for expected outcome
    expect(newRatingB).toBeLessThan(1200);
  });

  it("lower-rated beats higher: large gain (upset)", () => {
    // B is much lower rated — beating A is an upset, large reward
    const { newRatingA, newRatingB } = calculateElo(1800, 1200, "b");

    // B's gain should be large (close to K=32)
    expect(newRatingB - 1200).toBeGreaterThan(30);
    expect(newRatingA - 1800).toBeLessThan(-30);
  });

  it("Elo changes are zero-sum (sumA + sumB = 0 within rounding)", () => {
    // Test multiple scenarios for zero-sum property
    const scenarios: Array<{ rA: number; rB: number; winner: "a" | "b" }> = [
      { rA: 1500, rB: 1500, winner: "a" },
      { rA: 1600, rB: 1400, winner: "b" },
      { rA: 1200, rB: 1800, winner: "a" },
      { rA: 1750, rB: 1250, winner: "b" },
      { rA: 1500, rB: 1500, winner: "b" },
    ];

    for (const { rA, rB, winner } of scenarios) {
      const { newRatingA, newRatingB } = calculateElo(rA, rB, winner);
      const totalBefore = rA + rB;
      const totalAfter = newRatingA + newRatingB;
      // Allow ±0.02 for rounding of the two independent round operations
      expect(Math.abs(totalAfter - totalBefore)).toBeLessThanOrEqual(0.02);
    }
  });

  it("initial Elo constant is 1500", () => {
    expect(ELO_INITIAL).toBe(1500);
  });
});
