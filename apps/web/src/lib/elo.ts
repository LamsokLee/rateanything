/**
 * Pure Elo rating calculation utility.
 * K-factor: 32 (standard for systems building initial rankings).
 *
 * Formula reference: https://en.wikipedia.org/wiki/Elo_rating_system
 *
 * Properties:
 * - Zero-sum: the combined Elo change across both players sums to 0 (within rounding).
 * - Expected outcome: when ratings are equal, winner gains ~16.
 * - Upset bonus: beating a higher-rated opponent yields a larger gain.
 *
 * @param ratingA - Current Elo of option A
 * @param ratingB - Current Elo of option B
 * @param winner - "a" or "b" indicating which option won
 * @returns { newRatingA, newRatingB } — Updated Elo ratings (rounded to 2 dp)
 */

/** K-factor controls rating volatility. 32 is standard for new/active systems. */
export const ELO_K_FACTOR = 32;

/** Starting Elo for all options. 1500 is the universal convention. */
export const ELO_INITIAL = 1500;

export function calculateElo(
  ratingA: number,
  ratingB: number,
  winner: "a" | "b"
): { newRatingA: number; newRatingB: number } {
  // Expected score for A: probability A beats B given current ratings.
  // Uses the logistic curve: E_A = 1 / (1 + 10^((R_B - R_A) / 400))
  const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  // Expected score for B is the complement (zero-sum property)
  const expectedB = 1 - expectedA;

  // Actual scores: 1 for win, 0 for loss (no draws in this system)
  const scoreA = winner === "a" ? 1 : 0;
  const scoreB = 1 - scoreA;

  // New ratings: R' = R + K * (S - E)
  // Rounded to 2 decimal places for clean storage in PostgreSQL real columns
  const newRatingA = Math.round((ratingA + ELO_K_FACTOR * (scoreA - expectedA)) * 100) / 100;
  const newRatingB = Math.round((ratingB + ELO_K_FACTOR * (scoreB - expectedB)) * 100) / 100;

  return { newRatingA, newRatingB };
}
