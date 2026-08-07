"use client";

/**
 * AIVotes — Displays AI model votes for each option in a topic.
 * Groups votes by option, sorted by score spread (disagreement) descending.
 * Each option shows model name, score (1-10), and expandable rationale.
 * Emphasizes divergence via spread indicator and color-coded scores.
 */
import { useState, useEffect, useCallback } from "react";
import { Skeleton } from "./Skeleton";

interface ModelVote {
  username: string;
  avatarUrl: string | null;
  score: number;
  comment: string | null;
}

interface OptionVotes {
  optionId: string;
  optionName: string;
  votes: ModelVote[];
  spread: number;
  min: number;
  max: number;
}

interface AIVotesProps {
  topicId: string;
}

/** Map score (1-10) to a Tailwind text color class emphasizing extremes */
function scoreColor(score: number): string {
  if (score <= 3) return "text-red-500";
  if (score <= 5) return "text-amber-500";
  if (score <= 7) return "text-emerald-500";
  return "text-green-400";
}

/** Spread badge color — higher spread = more disagreement = warmer color */
function spreadBadge(spread: number): { bg: string; text: string } {
  if (spread >= 6) return { bg: "rgba(239, 68, 68, 0.15)", text: "#ef4444" };
  if (spread >= 4) return { bg: "rgba(249, 115, 22, 0.15)", text: "#f97316" };
  if (spread >= 2) return { bg: "rgba(251, 191, 36, 0.15)", text: "#fbbf24" };
  return { bg: "rgba(34, 197, 94, 0.12)", text: "#22c55e" };
}

export function AIVotes({ topicId }: AIVotesProps) {
  const [data, setData] = useState<OptionVotes[]>([]);
  const [state, setState] = useState<"loading" | "empty" | "populated" | "error">("loading");
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());

  const fetchVotes = useCallback(async () => {
    setState("loading");
    try {
      const res = await fetch(
        `/api/trpc/ratings.getModelVotesForTopic?input=${encodeURIComponent(
          JSON.stringify({ json: { topicId } })
        )}`
      );
      if (!res.ok) throw new Error("Failed to fetch AI votes");

      const json = await res.json();
      const result: OptionVotes[] = json?.result?.data?.json;

      if (!result || result.length === 0) {
        setState("empty");
        return;
      }

      setData(result);
      setState("populated");
    } catch {
      setState("error");
    }
  }, [topicId]);

  useEffect(() => {
    fetchVotes();
  }, [fetchVotes]);

  const toggleComment = (key: string) => {
    setExpandedComments((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (state === "loading") {
    return (
      <section className="border border-border/60 rounded-xl bg-card/60 p-5 sm:p-6 space-y-3">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">AI Votes</h2>
        <Skeleton className="h-20 w-full rounded-lg" />
        <Skeleton className="h-20 w-full rounded-lg" />
      </section>
    );
  }

  if (state === "empty") return null;

  if (state === "error") {
    return (
      <section className="border border-border/60 rounded-xl bg-card/60 p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">AI Votes</h2>
        <p className="mt-2 text-sm text-subtle">Could not load AI votes.</p>
      </section>
    );
  }

  return (
    <section className="border border-border/60 rounded-xl bg-card/60 p-5 sm:p-6 space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">AI Votes</h2>
        <span className="text-[11px] text-subtle/70">Sorted by disagreement</span>
      </div>

      <div className="space-y-3">
        {data.map((option) => {
          const badge = spreadBadge(option.spread);
          return (
            <div
              key={option.optionId}
              className="border border-border/40 rounded-lg bg-muted/10 p-4 space-y-3"
            >
              {/* Option header with spread indicator */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="text-sm font-medium text-foreground">{option.optionName}</h3>
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
                    style={{ background: badge.bg, color: badge.text }}
                  >
                    spread: {option.min}–{option.max}
                  </span>
                </div>
              </div>

              {/* Model votes grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {option.votes.map((vote) => {
                  const commentKey = `${option.optionId}-${vote.username}`;
                  const isExpanded = expandedComments.has(commentKey);
                  return (
                    <div
                      key={vote.username}
                      className="flex flex-col gap-1 border border-border/30 rounded-md px-3 py-2 bg-card/40"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-mono text-subtle truncate">
                          {vote.username}
                        </span>
                        <span className={`text-sm font-bold tabular-nums ${scoreColor(vote.score)}`}>
                          {vote.score}/10
                        </span>
                      </div>
                      {vote.comment && (
                        <button
                          onClick={() => toggleComment(commentKey)}
                          className="text-left text-[11px] text-subtle/70 hover:text-foreground transition-colors"
                        >
                          {isExpanded ? vote.comment : `${vote.comment.slice(0, 60)}${vote.comment.length > 60 ? "…" : ""}`}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
