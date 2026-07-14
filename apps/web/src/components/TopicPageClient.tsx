"use client";

/**
 * TopicPageClient — Client-side wrapper for the topic detail page.
 * Manages the mode switch between Arena (default) and Ratings.
 *
 * Arena mode renders the ArenaView (pairwise comparison) + ArenaLeaderboard.
 * Ratings mode renders the existing OptionRow table with 1-10 inline voting.
 *
 * Mode state is driven by URL ?mode= param (via TopicModeToggle)
 * with Arena as the default, matching the "Arena-first" requirement.
 */
import { useSearchParams } from "next/navigation";
import { TopicModeToggle } from "./TopicModeToggle";
import { ArenaView } from "./ArenaView";
import { ArenaLeaderboard } from "./ArenaLeaderboard";
import { OptionRow } from "./OptionRow";

interface HistoryPoint {
  timestamp: string;
  avgScore: number;
  count: number;
}

interface OptionData {
  id: string;
  name: string;
  avgRating: number | null;
  ratingCount: number | null;
  userRating: number | null;
}

interface TopicPageClientProps {
  topicId: string;
  sortedOptions: OptionData[];
  optionColorMap: Record<string, string>;
  historyByOption: Record<string, HistoryPoint[]>;
  chartColors: string[];
}

function getRankBadge(index: number): { bg: string; text: string } | null {
  if (index === 0) return { bg: "#fbbf24", text: "#451a03" }; // gold
  if (index === 1) return { bg: "#9ca3af", text: "#111827" }; // silver
  if (index === 2) return { bg: "#b45309", text: "#ffffff" }; // bronze
  return null;
}

export function TopicPageClient({
  topicId,
  sortedOptions,
  optionColorMap,
  historyByOption,
  chartColors,
}: TopicPageClientProps) {
  const searchParams = useSearchParams();
  // Arena is the default mode — "Arena-first" requirement
  const modeParam = searchParams.get("mode");
  const mode: "arena" | "rate" = modeParam === "rate" ? "rate" : "arena";

  return (
    <div className="space-y-4">
      {/* Mode toggle — always visible, URL-param driven */}
      <div className="flex items-center justify-between">
        <TopicModeToggle mode={mode} />
        {mode === "arena" && (
          <span className="text-[10px] text-subtle/50 hidden sm:inline">
            Pick your favorite in each matchup
          </span>
        )}
      </div>

      {/* Arena panel */}
      {mode === "arena" && (
        <div
          id="panel-arena"
          role="tabpanel"
          aria-labelledby="tab-arena"
          className="space-y-6"
        >
          <ArenaView topicId={topicId} />
          <ArenaLeaderboard topicId={topicId} />
        </div>
      )}

      {/* Ratings panel — existing 1-10 rating UI */}
      {mode === "rate" && (
        <div
          id="panel-ratings"
          role="tabpanel"
          aria-labelledby="tab-ratings"
        >
          <section className="border border-border/60 rounded-xl bg-card/60 overflow-hidden">
            <div className="px-5 py-4 border-b border-border/60 bg-card/80">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                  Options
                </h2>
                <span className="text-xs text-muted-foreground">
                  Ranked by average rating
                </span>
              </div>
            </div>

            {/* Mobile: card layout */}
            <div className="md:hidden divide-y divide-border/40">
              {sortedOptions.map((option, index) => {
                const optColor =
                  optionColorMap[option.id] ??
                  chartColors[index % chartColors.length];
                const rankBadge = getRankBadge(index);

                return (
                  <OptionRow
                    key={option.id}
                    optionId={option.id}
                    name={option.name}
                    initialAvgRating={option.avgRating ?? 0}
                    initialRatingCount={option.ratingCount ?? 0}
                    userRating={option.userRating}
                    rank={index + 1}
                    rankBadge={rankBadge}
                    optColor={optColor}
                    history={historyByOption[option.id]}
                    layout="mobile"
                  />
                );
              })}
            </div>

            {/* Desktop: table layout */}
            <div className="hidden md:block">
              {/* Table header */}
              <div className="grid grid-cols-[2.5rem_1fr_5rem_6rem_19.5rem] gap-3 items-center px-5 py-3 bg-card/80 border-b border-border/60 text-[10px] uppercase tracking-wider font-semibold text-subtle/70">
                <span className="text-center">#</span>
                <span>Option</span>
                <span className="text-right">Score</span>
                <span className="text-right">Trend</span>
                <span className="text-center">Your Rating</span>
              </div>

              {/* Table rows */}
              {sortedOptions.map((option, index) => {
                const optColor =
                  optionColorMap[option.id] ??
                  chartColors[index % chartColors.length];
                const rankBadge = getRankBadge(index);

                return (
                  <OptionRow
                    key={option.id}
                    optionId={option.id}
                    name={option.name}
                    initialAvgRating={option.avgRating ?? 0}
                    initialRatingCount={option.ratingCount ?? 0}
                    userRating={option.userRating}
                    rank={index + 1}
                    rankBadge={rankBadge}
                    optColor={optColor}
                    history={historyByOption[option.id]}
                    layout="desktop"
                  />
                );
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
