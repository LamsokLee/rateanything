"use client";

/**
 * OptionRow — Client component for a single option row in the topic table.
 * Holds reactive state for avgRating/ratingCount so scores update live
 * after a successful submit or cancel (via onScoreUpdate callback from InlineRatingButtons).
 */
import { useEffect, useState } from "react";
import { InlineRatingButtons } from "./InlineRatingButtons";
import { Sparkline } from "./Sparkline";

interface HistoryPoint {
  timestamp: string;
  avgScore: number;
  count: number;
}

interface RankBadge {
  bg: string;
  text: string;
}

export interface OptionRowProps {
  optionId: string;
  name: string;
  initialAvgRating: number;
  initialRatingCount: number;
  userRating: number | null;
  rank: number;
  rankBadge: RankBadge | null;
  optColor: string;
  history: HistoryPoint[] | undefined;
  layout: "mobile" | "desktop";
}

export function OptionRow({
  optionId,
  name,
  initialAvgRating,
  initialRatingCount,
  userRating,
  rank,
  rankBadge,
  optColor,
  history,
  layout,
}: OptionRowProps) {
  const [avg, setAvg] = useState(initialAvgRating);
  const [count, setCount] = useState(initialRatingCount);

  // Re-sync local state when SSR props change (e.g. after navigation or router.refresh)
  useEffect(() => {
    setAvg(initialAvgRating);
    setCount(initialRatingCount);
  }, [initialAvgRating, initialRatingCount]);

  const hasRatings = count > 0;

  if (layout === "mobile") {
    return (
      <div className="p-4 hover:bg-muted/20 transition-colors duration-100">
        {/* Option header: rank + name */}
        <div className="flex items-center gap-3">
          {rankBadge ? (
            <span
              className="flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold shrink-0"
              style={{ backgroundColor: rankBadge.bg, color: rankBadge.text }}
            >
              {rank}
            </span>
          ) : (
            <span className="w-6 h-6 flex items-center justify-center text-xs font-mono text-subtle/70 shrink-0">
              {rank}
            </span>
          )}
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: optColor }}
          />
          <span className="text-sm font-semibold text-foreground truncate">
            {name}
          </span>
        </div>

        {/* Score + votes + trend row */}
        <div className="flex items-center justify-between mt-3 pl-9">
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <span className="font-mono text-sm font-bold text-foreground">
                {hasRatings ? avg.toFixed(1) : "\u2014"}
              </span>
              <span className="font-mono text-[10px] text-subtle/50">
                {count} votes
              </span>
            </div>
          </div>
          {history && history.length >= 2 && (
            <Sparkline
              data={history}
              color={optColor}
              width={72}
              height={24}
              showArea
              showTrendIndicator={false}
            />
          )}
        </div>

        {/* Vote buttons */}
        <div className="mt-3 pl-9">
          <InlineRatingButtons
            optionId={optionId}
            currentUserRating={userRating}
            onScoreUpdate={(a, c) => { setAvg(a); setCount(c); }}
          />
        </div>
      </div>
    );
  }

  // Desktop layout
  return (
    <div className="grid grid-cols-[2.5rem_1fr_5rem_6rem_19.5rem] gap-3 items-center px-5 py-3.5 border-b border-border/30 last:border-b-0 hover:bg-muted/20 transition-colors duration-100">
      {/* Rank */}
      <div className="flex justify-center">
        {rankBadge ? (
          <span
            className="flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-bold"
            style={{ backgroundColor: rankBadge.bg, color: rankBadge.text }}
          >
            {rank}
          </span>
        ) : (
          <span className="text-xs font-mono text-subtle/70">
            {rank}
          </span>
        )}
      </div>

      {/* Option name with color dot */}
      <div className="flex items-center gap-2.5 min-w-0">
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: optColor }}
        />
        <span className="text-sm font-medium text-foreground truncate">
          {name}
        </span>
      </div>

      {/* Score */}
      <div className="text-right">
        <span className="font-mono text-sm font-bold text-foreground">
          {hasRatings ? avg.toFixed(1) : "\u2014"}
        </span>
        <span className="block font-mono text-[10px] text-subtle/60">
          {count.toLocaleString()} votes
        </span>
      </div>

      {/* Trend sparkline */}
      <div className="flex justify-end">
        {history && history.length >= 2 ? (
          <Sparkline
            data={history}
            color={optColor}
            width={76}
            height={22}
            showArea
            showTrendIndicator={false}
          />
        ) : (
          <span className="text-[10px] text-subtle/50 font-mono">{"\u2014"}</span>
        )}
      </div>

      {/* Inline vote buttons */}
      <div className="flex justify-center">
        <InlineRatingButtons
          optionId={optionId}
          currentUserRating={userRating}
          onScoreUpdate={(a, c) => { setAvg(a); setCount(c); }}
        />
      </div>
    </div>
  );
}
