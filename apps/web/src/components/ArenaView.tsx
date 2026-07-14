"use client";

/**
 * ArenaView — Pairwise comparison UI for Arena mode.
 *
 * Renders two option cards side-by-side (desktop) or stacked (mobile).
 * Users pick a winner via:
 *   - Tap/click on a card (primary interaction, always available)
 *   - Keyboard: 1/2 keys or ArrowLeft/ArrowRight
 *   - Mobile swipe: left picks option A, right picks option B
 *
 * State flow:
 *   idle → picking (user taps) → submitting (winner shown optimistically)
 *        → revealing (vote confirmed) → idle (next pair)
 *
 * Non-obvious logic:
 *   - Swipe detection uses pointer events (no gesture library needed).
 *     A horizontal swipe > 50px with velocity > 0.3px/ms triggers pick.
 *   - The winner badge is shown immediately on tap, before the server responds,
 *     so the UI feels instant. The vote is submitted in the background.
 *   - The next pair is fetched in parallel with the reveal timer so new cards
 *     appear as soon as the animation ends.
 */
import { useState, useCallback, useRef, useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { Skeleton } from "./Skeleton";

/** Minimum horizontal distance (px) to count as a swipe */
const SWIPE_THRESHOLD = 50;
/** Minimum velocity (px/ms) for swipe */
const SWIPE_VELOCITY = 0.3;
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

  // Swipe tracking refs
  const pointerStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  /** Fetches pair data without side effects. Returns the raw JSON result. */
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
      // Optimistically show the winner immediately while the vote is submitted.
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

        // Vote confirmed — advance to reveal and fetch next pair.
        setMatchCount((c) => c + 1);
        setState("revealing");

        // Fetch next pair in parallel with the reveal timer so the new cards
        // are ready as soon as the animation ends.
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

      // Regardless of skip success, fetch next pair
      fetchPair();
    } catch {
      // Skip failures are non-critical, just load next pair
      fetchPair();
    }
  }, [optionA, optionB, state, topicId, user, fetchPair]);

  // Initial fetch on mount
  useEffect(() => {
    fetchPair();
  }, [fetchPair]);

  /** Keyboard handler: 1/2 to pick, ArrowLeft/Right, S to skip */
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

  /**
   * Swipe detection via pointer events.
   * Only triggers on horizontal swipes exceeding threshold + velocity.
   * Left swipe = pick A, Right swipe = pick B (labeled visually).
   */
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    pointerStartRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
  }, []);

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!pointerStartRef.current || state !== "idle") return;

      const dx = e.clientX - pointerStartRef.current.x;
      const dy = e.clientY - pointerStartRef.current.y;
      const dt = Date.now() - pointerStartRef.current.time;
      pointerStartRef.current = null;

      // Ignore if vertical movement dominates (scrolling)
      if (Math.abs(dy) > Math.abs(dx)) return;

      const absDx = Math.abs(dx);
      const velocity = dt > 0 ? absDx / dt : 0;

      if (absDx >= SWIPE_THRESHOLD && velocity >= SWIPE_VELOCITY) {
        // Left swipe (negative dx) = pick option A (left card)
        // Right swipe (positive dx) = pick option B (right card)
        if (dx < 0 && optionA) {
          submitVote(optionA.id);
        } else if (dx > 0 && optionB) {
          submitVote(optionB.id);
        }
      }
    },
    [state, optionA, optionB, submitVote]
  );

  // --- Render states ---

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

  const isRevealing = state === "revealing";
  const isSubmitting = state === "submitting";
  const isDisabled = isRevealing || isSubmitting;
  const hasVoteResult = voteResult !== null;

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

      {/* Swipe hint for mobile */}
      <div className="flex items-center justify-between text-[10px] text-subtle/50 px-1 sm:hidden">
        <span aria-hidden="true">← swipe left for A</span>
        <span aria-hidden="true">swipe right for B →</span>
      </div>

      {/* Arena cards container */}
      <div
        ref={containerRef}
        className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 touch-pan-y"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        role="group"
        aria-label="Choose between two options"
      >
        {/* Option A card */}
        {optionA && (
          <ArenaCard
            option={optionA}
            label="A"
            keyHint="1"
            onPick={() => submitVote(optionA.id)}
            disabled={isDisabled}
            isWinner={(isRevealing || isSubmitting) && hasVoteResult && voteResult!.winnerId === optionA.id}
            isLoser={(isRevealing || isSubmitting) && hasVoteResult && voteResult!.winnerId !== optionA.id}
          />
        )}

        {/* VS divider */}
        <div className="hidden sm:flex items-center justify-center absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true">
          {/* This is positioned via the parent grid; on mobile it's inline */}
        </div>
        <div className="flex sm:hidden items-center justify-center py-1" aria-hidden="true">
          <span className="text-xs font-bold text-subtle/50 uppercase">vs</span>
        </div>

        {/* Option B card */}
        {optionB && (
          <ArenaCard
            option={optionB}
            label="B"
            keyHint="2"
            onPick={() => submitVote(optionB.id)}
            disabled={isDisabled}
            isWinner={(isRevealing || isSubmitting) && hasVoteResult && voteResult!.winnerId === optionB.id}
            isLoser={(isRevealing || isSubmitting) && hasVoteResult && voteResult!.winnerId !== optionB.id}
          />
        )}
      </div>

      {/* Desktop keyboard hints + skip */}
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

      {/* Keyboard legend for desktop */}
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

// --- ArenaCard sub-component ---

interface ArenaCardProps {
  option: ArenaOption;
  label: string;
  keyHint: string;
  onPick: () => void;
  disabled: boolean;
  isWinner: boolean;
  isLoser: boolean;
}

function ArenaCard({
  option,
  label,
  keyHint,
  onPick,
  disabled,
  isWinner,
  isLoser,
}: ArenaCardProps) {
  return (
    <button
      onClick={onPick}
      disabled={disabled}
      aria-label={`Pick ${option.name} (option ${label})`}
      className={`relative flex flex-col items-center justify-center gap-3 p-6 sm:p-8 rounded-xl border-2 transition-all duration-200 text-left w-full min-h-[120px] sm:min-h-[160px] ${
        isWinner
          ? "border-green-500 bg-green-500/10 scale-[1.02]"
          : isLoser
          ? "border-red-500/50 bg-red-500/5 opacity-60 scale-[0.98]"
          : disabled
          ? "border-border/40 bg-card/60 cursor-not-allowed opacity-60"
          : "border-border/60 bg-card/60 hover:border-accent/60 hover:bg-accent/5 cursor-pointer active:scale-[0.98]"
      }`}
    >
      {/* Label badge */}
      <span
        className="absolute top-2 left-2 w-6 h-6 flex items-center justify-center rounded-full bg-muted text-[10px] font-bold text-subtle"
        aria-hidden="true"
      >
        {label}
      </span>

      {/* Keyboard hint */}
      <span
        className="absolute top-2 right-2 hidden sm:flex items-center justify-center px-1.5 py-0.5 rounded border border-border/60 text-[9px] font-mono text-subtle/50"
        aria-hidden="true"
      >
        {keyHint}
      </span>

      {/* Option name */}
      <span className="text-sm sm:text-base font-semibold text-foreground text-center leading-tight">
        {option.name}
      </span>

      {/* Pick prompt — hidden after vote */}
      {!isWinner && !isLoser && (
        <span className="text-[10px] text-subtle/40 italic">Tap to pick</span>
      )}

      {/* Winner badge on reveal */}
      {isWinner && (
        <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs font-bold text-green-600 uppercase">
          Winner!
        </span>
      )}
    </button>
  );
}

// --- Loading skeleton ---

function ArenaLoadingSkeleton() {
  return (
    <div className="space-y-4" data-testid="arena-loading">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div className="flex flex-col items-center justify-center gap-3 p-6 sm:p-8 rounded-xl border-2 border-border/40 bg-card/60 min-h-[120px] sm:min-h-[160px]">
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="flex flex-col items-center justify-center gap-3 p-6 sm:p-8 rounded-xl border-2 border-border/40 bg-card/60 min-h-[120px] sm:min-h-[160px]">
          <Skeleton className="h-5 w-32" />
        </div>
      </div>
      <div className="flex items-center justify-center">
        <Skeleton className="h-8 w-20 rounded-md" />
      </div>
    </div>
  );
}
