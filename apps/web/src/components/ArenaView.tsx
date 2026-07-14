"use client";

/**
 * ArenaView — Pairwise comparison UI for Arena mode.
 *
 * Mobile-first design: options are presented as a single card split down the
 * middle by a vertical divider. Left half = option A, right half = option B.
 * Users tap either half to vote. Desktop also uses the split-card layout for
 * consistency, with slightly more generous padding.
 *
 * State flow:
 *   idle → picking (user taps a half) → submitting (winner shown optimistically)
 *        → revealing (vote confirmed) → idle (next pair)
 */
import { useState, useCallback, useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { Skeleton } from "./Skeleton";

/** Time to show result before loading next pair (ms) */
const REVEAL_DURATION = 600;

interface ArenaOption {
  id: string;
  name: string;
  imageUrl: string | null;
  matchCount: number;
}

interface ArenaViewProps {
  topicId: string;
}

type ArenaState = "loading" | "idle" | "submitting" | "revealing" | "error" | "insufficient" | "empty";

interface VoteResult {
  winnerId: string;
}

interface PairResponse {
  insufficientOptions?: boolean;
  optionA: ArenaOption | null;
  optionB: ArenaOption | null;
}

/** Simple browser fingerprint for guest arena votes */
function getFingerprint(): string {
  if (typeof window === "undefined") return "server";
  const nav = window.navigator;
  const raw = [
    nav.userAgent,
    nav.language,
    new Date().getTimezoneOffset().toString(),
    screen.width.toString(),
    screen.height.toString(),
  ].join("|");
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export function ArenaView({ topicId }: ArenaViewProps) {
  const { user } = useAuth();
  const [state, setState] = useState<ArenaState>("loading");
  const [optionA, setOptionA] = useState<ArenaOption | null>(null);
  const [optionB, setOptionB] = useState<ArenaOption | null>(null);
  const [voteResult, setVoteResult] = useState<VoteResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [matchCount, setMatchCount] = useState(0);

  /** Fetches pair data without side effects. */
  const fetchPairData = useCallback(async () => {
    const res = await fetch(
      `/api/trpc/arena.getPair?input=${encodeURIComponent(JSON.stringify({ json: { topicId } }))}`
    );
    if (!res.ok) {
      throw new Error("Failed to fetch pair");
    }
    const data = await res.json();
    const result = data?.result?.data?.json;
    if (!result) {
      throw new Error("Unexpected response from server");
    }
    return result as PairResponse;
  }, [topicId]);

  /** Fetch a new pair and update UI state */
  const fetchPair = useCallback(async () => {
    setState("loading");
    setVoteResult(null);
    try {
      const result = await fetchPairData();
      if (result.insufficientOptions) {
        setState("insufficient");
        return;
      }
      if (!result.optionA || !result.optionB) {
        setState("empty");
        return;
      }
      setOptionA(result.optionA);
      setOptionB(result.optionB);
      setState("idle");
    } catch (err) {
      setState("error");
      setErrorMessage(err instanceof Error ? err.message : "Network error");
    }
  }, [fetchPairData]);

  /** Submit a vote for the given winner */
  const submitVote = useCallback(
    async (winnerOptionId: string) => {
      if (!optionA || !optionB || state !== "idle") return;
      setVoteResult({ winnerId: winnerOptionId });
      setState("submitting");

      try {
        const payload: {
          topicId: string;
          optionAId: string;
          optionBId: string;
          winnerOptionId: string;
          guestFingerprint?: string;
        } = {
          topicId,
          optionAId: optionA.id,
          optionBId: optionB.id,
          winnerOptionId,
        };

        if (!user) {
          payload.guestFingerprint = getFingerprint();
        }

        const res = await fetch("/api/trpc/arena.vote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ json: payload }),
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => null);
          const msg = errBody?.error?.json?.message ?? errBody?.error?.message ?? "Vote failed";
          throw new Error(msg);
        }

        await res.json();

        setMatchCount((c) => c + 1);
        setState("revealing");

        const nextPairPromise = fetchPairData();
        const timerPromise = new Promise<void>((resolve) =>
          setTimeout(resolve, REVEAL_DURATION)
        );

        try {
          const [result] = await Promise.all([nextPairPromise, timerPromise]);
          if (result.insufficientOptions) {
            setState("insufficient");
            return;
          }
          if (!result.optionA || !result.optionB) {
            setState("empty");
            return;
          }
          setOptionA(result.optionA);
          setOptionB(result.optionB);
          setVoteResult(null);
          setState("idle");
        } catch (err) {
          setState("error");
          setErrorMessage(err instanceof Error ? err.message : "Network error");
        }
      } catch (err) {
        setState("error");
        setErrorMessage(err instanceof Error ? err.message : "Vote failed");
      }
    },
    [optionA, optionB, state, topicId, user, fetchPairData]
  );

  /** Submit a skip */
  const submitSkip = useCallback(async () => {
    if (!optionA || !optionB || state !== "idle") return;
    setState("submitting");

    try {
      const payload: {
        topicId: string;
        optionAId: string;
        optionBId: string;
        guestFingerprint?: string;
      } = {
        topicId,
        optionAId: optionA.id,
        optionBId: optionB.id,
      };

      if (!user) {
        payload.guestFingerprint = getFingerprint();
      }

      await fetch("/api/trpc/arena.skip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json: payload }),
      });

      fetchPair();
    } catch {
      fetchPair();
    }
  }, [optionA, optionB, state, topicId, user, fetchPair]);

  // Initial fetch on mount
  useEffect(() => {
    fetchPair();
  }, [fetchPair]);

  /** Keyboard handler: 1/ArrowLeft = A, 2/ArrowRight = B, S = skip */
  useEffect(() => {
    if (state !== "idle") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "1" || e.key === "ArrowLeft") {
        e.preventDefault();
        if (optionA) submitVote(optionA.id);
      } else if (e.key === "2" || e.key === "ArrowRight") {
        e.preventDefault();
        if (optionB) submitVote(optionB.id);
      } else if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        submitSkip();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [state, optionA, optionB, submitVote, submitSkip]);

  // --- Render helpers ---

  const isRevealing = state === "revealing";
  const isSubmitting = state === "submitting";
  const isDisabled = isRevealing || isSubmitting;
  const hasVoteResult = voteResult !== null;

  if (state === "loading") {
    return <ArenaLoadingSkeleton />;
  }

  if (state === "insufficient") {
    return (
      <div className="border border-border/60 rounded-xl bg-card/60 p-8 text-center" role="status">
        <p className="text-sm text-muted-foreground">
          This topic needs at least 2 options for Arena mode.
        </p>
      </div>
    );
  }

  if (state === "empty") {
    return (
      <div className="border border-border/60 rounded-xl bg-card/60 p-8 text-center" role="status">
        <p className="text-sm text-muted-foreground">
          No options available for comparison right now.
        </p>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="border border-border/60 rounded-xl bg-card/60 p-8 text-center" role="alert">
        <p className="text-sm text-red-500 mb-3">{errorMessage || "Something went wrong"}</p>
        <button
          onClick={fetchPair}
          className="px-4 py-2 rounded-lg bg-accent text-accent-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Match counter */}
      {matchCount > 0 && (
        <div className="text-center">
          <span className="text-[10px] font-mono text-subtle/70 uppercase tracking-wider">
            Matches completed: {matchCount}
          </span>
        </div>
      )}

      {/* Split card */}
      <div className="relative rounded-xl border-2 border-border/60 overflow-hidden bg-card/60" role="group" aria-label="Choose between two options">
        <div className="grid grid-cols-2 divide-x divide-border/60">
          {/* Left half — Option A */}
          {optionA && (
            <button
              onClick={() => submitVote(optionA.id)}
              disabled={isDisabled}
              aria-label={`Pick ${optionA.name} (option A)`}
              className={`relative flex flex-col items-center justify-center gap-2 p-4 sm:p-8 min-h-[120px] sm:min-h-[160px] transition-all duration-200 text-center ${
                (isRevealing || isSubmitting) && hasVoteResult && voteResult!.winnerId === optionA.id
                  ? "bg-green-500/10"
                  : (isRevealing || isSubmitting) && hasVoteResult && voteResult!.winnerId !== optionA.id
                  ? "bg-red-500/5 opacity-50"
                  : isDisabled
                  ? "cursor-not-allowed opacity-60"
                  : "hover:bg-accent/5 cursor-pointer active:scale-[0.98]"
              }`}
            >
              <span
                className="absolute top-2 left-2 w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center rounded-full bg-muted text-[9px] sm:text-[10px] font-bold text-subtle"
                aria-hidden="true"
              >
                A
              </span>

              <span className="text-xs sm:text-base font-semibold text-foreground leading-tight px-6">
                {optionA.name}
              </span>

              {/* Pick prompt */}
              {!(isRevealing || isSubmitting) && (
                <span className="text-[9px] sm:text-[10px] text-subtle/40 italic">Tap to pick</span>
              )}

              {/* Winner badge */}
              {(isRevealing || isSubmitting) && hasVoteResult && voteResult!.winnerId === optionA.id && (
                <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] sm:text-xs font-bold text-green-600 uppercase">
                  Winner!
                </span>
              )}
            </button>
          )}

          {/* Right half — Option B */}
          {optionB && (
            <button
              onClick={() => submitVote(optionB.id)}
              disabled={isDisabled}
              aria-label={`Pick ${optionB.name} (option B)`}
              className={`relative flex flex-col items-center justify-center gap-2 p-4 sm:p-8 min-h-[120px] sm:min-h-[160px] transition-all duration-200 text-center ${
                (isRevealing || isSubmitting) && hasVoteResult && voteResult!.winnerId === optionB.id
                  ? "bg-green-500/10"
                  : (isRevealing || isSubmitting) && hasVoteResult && voteResult!.winnerId !== optionB.id
                  ? "bg-red-500/5 opacity-50"
                  : isDisabled
                  ? "cursor-not-allowed opacity-60"
                  : "hover:bg-accent/5 cursor-pointer active:scale-[0.98]"
              }`}
            >
              <span
                className="absolute top-2 right-2 w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center rounded-full bg-muted text-[9px] sm:text-[10px] font-bold text-subtle"
                aria-hidden="true"
              >
                B
              </span>

              <span className="text-xs sm:text-base font-semibold text-foreground leading-tight px-6">
                {optionB.name}
              </span>

              {/* Pick prompt */}
              {!(isRevealing || isSubmitting) && (
                <span className="text-[9px] sm:text-[10px] text-subtle/40 italic">Tap to pick</span>
              )}

              {/* Winner badge */}
              {(isRevealing || isSubmitting) && hasVoteResult && voteResult!.winnerId === optionB.id && (
                <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] sm:text-xs font-bold text-green-600 uppercase">
                  Winner!
                </span>
              )}
            </button>
          )}
        </div>

        {/* VS divider (centered overlay) */}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none"
          aria-hidden="true"
        >
          <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-background border border-border/80 shadow-sm">
            <span className="text-[10px] sm:text-xs font-bold text-subtle/60 uppercase">VS</span>
          </div>
        </div>
      </div>

      {/* Skip button */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={submitSkip}
          disabled={isDisabled}
          className="px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-border/40 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Skip this pair"
        >
          Skip (S)
        </button>
      </div>

      {/* Keyboard legend (desktop only) */}
      <div className="hidden sm:flex items-center justify-center gap-4 text-[10px] text-subtle/50">
        <span>Press <kbd className="px-1 py-0.5 rounded border border-border/60 font-mono">1</kbd> or <kbd className="px-1 py-0.5 rounded border border-border/60 font-mono">←</kbd> for A</span>
        <span>•</span>
        <span>Press <kbd className="px-1 py-0.5 rounded border border-border/60 font-mono">2</kbd> or <kbd className="px-1 py-0.5 rounded border border-border/60 font-mono">→</kbd> for B</span>
        <span>•</span>
        <span>Press <kbd className="px-1 py-0.5 rounded border border-border/60 font-mono">S</kbd> to skip</span>
      </div>
    </div>
  );
}

// --- Loading skeleton ---

function ArenaLoadingSkeleton() {
  return (
    <div className="space-y-4" data-testid="arena-loading">
      <div className="rounded-xl border-2 border-border/40 overflow-hidden bg-card/60">
        <div className="grid grid-cols-2 divide-x divide-border/60">
          <div className="flex flex-col items-center justify-center gap-2 p-4 sm:p-8 min-h-[120px] sm:min-h-[160px]">
            <Skeleton className="h-4 sm:h-5 w-24 sm:w-32" />
          </div>
          <div className="flex flex-col items-center justify-center gap-2 p-4 sm:p-8 min-h-[120px] sm:min-h-[160px]">
            <Skeleton className="h-4 sm:h-5 w-24 sm:w-32" />
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center">
        <Skeleton className="h-8 w-20 rounded-md" />
      </div>
    </div>
  );
}
