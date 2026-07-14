"use client";

/**
 * ArenaLeaderboard — Displays ranked options for a topic.
 * Fetches from arena.getLeaderboard and renders a ranked list.
 * Shows: rank, name, and match count.
 *
 * States handled: loading, empty (no data), insufficient data, populated.
 */
import { useState, useEffect, useCallback } from "react";
import { Skeleton } from "./Skeleton";

interface LeaderboardEntry {
  rank: number;
  optionId: string;
  name: string;
  imageUrl: string | null;
  matchCount: number;
}

interface ArenaLeaderboardProps {
  topicId: string;
  /** Optional refresh trigger — increment to refetch */
  refreshKey?: number;
}

type LeaderboardState = "loading" | "empty" | "populated" | "error";

/** Minimum total matches before showing leaderboard as "meaningful" */
const MIN_MATCHES_THRESHOLD = 3;

export function ArenaLeaderboard({ topicId, refreshKey = 0 }: ArenaLeaderboardProps) {
  const [state, setState] = useState<LeaderboardState>("loading");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [totalVotes, setTotalVotes] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");

  const fetchLeaderboard = useCallback(async () => {
    setState("loading");
    try {
      const res = await fetch(
        `/api/trpc/arena.getLeaderboard?input=${encodeURIComponent(
          JSON.stringify({ json: { topicId } })
        )}`
      );
      if (!res.ok) throw new Error("Failed to fetch leaderboard");

      const data = await res.json();
      const result = data?.result?.data?.json;

      if (!result || !result.entries || result.entries.length === 0) {
        setState("empty");
        return;
      }

      setEntries(result.entries);
      setTotalVotes(result.totalVotes ?? 0);
      setState("populated");
    } catch (err) {
      setState("error");
      setErrorMessage(err instanceof Error ? err.message : "Failed to load leaderboard");
    }
  }, [topicId]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard, refreshKey]);

  if (state === "loading") {
    return <LeaderboardSkeleton />;
  }

  if (state === "error") {
    return (
      <div className="border border-border/60 rounded-xl bg-card/60 p-6 text-center" role="alert">
        <p className="text-sm text-red-500">{errorMessage}</p>
        <button
          onClick={fetchLeaderboard}
          className="mt-2 px-3 py-1.5 rounded-md text-xs bg-accent text-accent-foreground hover:opacity-90"
        >
          Retry
        </button>
      </div>
    );
  }

  if (state === "empty") {
    return (
      <div className="border border-border/60 rounded-xl bg-card/60 p-6 text-center" role="status">
        <p className="text-sm text-muted-foreground">
          No arena votes yet. Be the first to compare!
        </p>
      </div>
    );
  }

  // Check if there's enough data for meaningful rankings
  const hasEnoughData = totalVotes >= MIN_MATCHES_THRESHOLD;

  return (
    <section className="border border-border/60 rounded-xl bg-card/60 overflow-hidden">
      <div className="px-5 py-4 border-b border-border/60 bg-card/80">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
            Arena Leaderboard
          </h3>
          <span className="text-xs text-muted-foreground font-mono">
            {totalVotes} {totalVotes === 1 ? "match" : "matches"}
          </span>
        </div>
      </div>

      {!hasEnoughData && (
        <div className="px-5 py-3 bg-amber-500/5 border-b border-amber-500/20" role="status">
          <p className="text-xs text-amber-600 dark:text-amber-400">
            ⚡ Early rankings — more votes needed for accurate positions.
          </p>
        </div>
      )}

      {/* Leaderboard table */}
      <div className="divide-y divide-border/30">
        {entries.map((entry) => (
          <div
            key={entry.optionId}
            className="flex items-center gap-3 px-5 py-3 hover:bg-muted/20 transition-colors duration-100"
          >
            {/* Rank */}
            <div className="w-7 flex justify-center shrink-0">
              {entry.rank <= 3 ? (
                <span
                  className="flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-bold"
                  style={{
                    backgroundColor:
                      entry.rank === 1
                        ? "#fbbf24"
                        : entry.rank === 2
                        ? "#9ca3af"
                        : "#b45309",
                    color:
                      entry.rank === 1
                        ? "#451a03"
                        : entry.rank === 2
                        ? "#111827"
                        : "#ffffff",
                  }}
                >
                  {entry.rank}
                </span>
              ) : (
                <span className="text-xs font-mono text-subtle/70">{entry.rank}</span>
              )}
            </div>

            {/* Name */}
            <span className="text-sm font-medium text-foreground truncate flex-1 min-w-0">
              {entry.name}
            </span>

            {/* Stats */}
            <div className="text-right shrink-0">
              <span className="block font-mono text-xs text-muted-foreground">
                {entry.matchCount}
              </span>
              <span className="block text-[9px] text-subtle/50 uppercase">Matches</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function LeaderboardSkeleton() {
  return (
    <section className="border border-border/60 rounded-xl bg-card/60 overflow-hidden" data-testid="leaderboard-loading">
      <div className="px-5 py-4 border-b border-border/60 bg-card/80">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <div className="divide-y divide-border/30">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-5 py-3">
            <Skeleton className="w-5 h-5 rounded-full shrink-0" />
            <Skeleton className="h-4 flex-1 max-w-[200px]" />
            <Skeleton className="h-4 w-10" />
          </div>
        ))}
      </div>
    </section>
  );
}
