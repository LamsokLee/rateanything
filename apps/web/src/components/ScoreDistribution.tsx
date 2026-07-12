"use client";

/**
 * ScoreDistribution — mini 10-bar histogram showing rating distribution.
 * Each bar represents how many users gave that score (1-10).
 */

interface ScoreDistributionProps {
  distribution: Record<number, number>;
  userRating: number | null;
}

export function ScoreDistribution({ distribution, userRating }: ScoreDistributionProps) {
  // Find the max count to normalize bar heights
  let maxCount = 0;
  for (let i = 1; i <= 10; i++) {
    const count = distribution[i] ?? 0;
    if (count > maxCount) maxCount = count;
  }

  if (maxCount === 0) return null;

  return (
    <div className="flex items-end gap-0.5 h-5">
      {Array.from({ length: 10 }, (_, i) => i + 1).map((score) => {
        const count = distribution[score] ?? 0;
        const heightPct = maxCount > 0 ? (count / maxCount) * 100 : 0;
        const isUserBar = userRating === score;

        return (
          <div
            key={score}
            className="flex-1 flex items-end justify-center"
            style={{ height: "20px" }}
            title={`Score ${score}: ${count} rating${count !== 1 ? "s" : ""}`}
          >
            <div
              className={`w-full rounded-sm transition-all duration-200 ${
                isUserBar ? "bg-accent" : "bg-muted-foreground"
              }`}
              style={{
                height: `${Math.max(heightPct, count > 0 ? 10 : 0)}%`,
                minHeight: count > 0 ? "2px" : "0px",
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
