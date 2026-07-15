"use client";

/**
 * ArenaView — Pairwise comparison UI for Arena mode.
 *
 * Single persistent card with a vertical divider. Left = option A, right = B.
 * When loading the next pair, the card stays in place and only the text
 * content swaps with a quick fade. No full-card reload.
 *
 * The card fills most of the mobile viewport for a more immersive experience.
 *
 * State flow:
 *   idle → picking (user taps) → flash (100ms winner shown)
 *        → swapping (text fades, fetch next pair) → idle (new text fades in)
 */
import { useState, useCallback, useEffect } from "react";
import { useAuth } from "./AuthProvider";

/** Brief winner flash before swapping text (ms) */
const WINNER_FLASH_MS = 100;
/** Text fade duration when swapping pairs (ms) */
const SWAP_FADE_MS = 150;

interface ArenaOption {
  id: string;
  name: string;
  imageUrl: string | null;
  matchCount: number;
}

interface ArenaViewProps {
  topicId: string;
}

type ArenaState = "loading" | "idle" | "picking" | "swapping" | "error" | "insufficient" | "empty";

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
  const [winnerId, setWinnerId] = useState<string | null>(null);
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

  /** Load the first pair */
  const loadInitialPair = useCallback(async () => {
    setState("loading");
    setWinnerId(null);
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

  /** Swap to next pair — card stays visible, only text changes */
  const swapPair = useCallback(async () => {
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
      setWinnerId(null);
      setState("idle");
    } catch (err) {
      setState("error");
      setErrorMessage(err instanceof Error ? err.message : "Network error");
    }
  }, [fetchPairData]);

  /** Submit a vote — fire and forget for snappy UX */
  const submitVote = useCallback(
    async (winnerOptionId: string) => {
      if (!optionA || !optionB || state !== "idle") return;

      setState("picking");
      setWinnerId(winnerOptionId);
      setMatchCount((c) => c + 1);

      // Build payload
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

      // Fire vote in background
      fetch("/api/trpc/arena.vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json: payload }),
      }).catch(console.error);

      // Brief winner flash, then fade out text and swap
      setTimeout(() => {
        setState("swapping");
        // Start fetching next pair in background; when ready, fade text back in
        swapPair();
      }, WINNER_FLASH_MS);
    },
    [optionA, optionB, state, topicId, user, swapPair]
  );

  /** Submit a skip — fire and forget */
  const submitSkip = useCallback(async () => {
    if (!optionA || !optionB || state !== "idle") return;

    setState("swapping");

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

    // Fire skip in background
    fetch("/api/trpc/arena.skip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ json: payload }),
    }).catch(console.error);

    // Fetch next pair immediately
    swapPair();
  }, [optionA, optionB, state, topicId, user, swapPair]);

  // Initial fetch on mount
  useEffect(() => {
    loadInitialPair();
  }, [loadInitialPair]);

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

  const isPicking = state === "picking";
  const isSwapping = state === "swapping";
  const isDisabled = isPicking || isSwapping;
  const isInitialLoading = state === "loading";

  // Text opacity: fade out during swap, fade in when idle
  const textOpacityClass = isSwapping ? "opacity-0" : "opacity-100";
  const textTransitionClass = `transition-opacity duration-[${SWAP_FADE_MS}ms]`;

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
          onClick={loadInitialPair}
          className="px-4 py-2 rounded-lg bg-accent text-accent-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] sm:h-auto sm:space-y-4">
      {/* Match counter */}
      {matchCount > 0 && (
        <div className="text-center py-2">
          <span className="text-[10px] font-mono text-subtle/70 uppercase tracking-wider">
            Matches: {matchCount}
          </span>
        </div>
      )}

      {/* Split card — fills most of the mobile viewport */}
      <div
        className="relative flex-1 sm:flex-none rounded-xl border-2 border-border/60 overflow-hidden bg-card/60"
        role="group"
        aria-label="Choose between two options"
      >
        <div className="grid grid-cols-2 h-full divide-x divide-border/60">
          {/* Left half — Option A */}
          <button
            onClick={() => optionA && submitVote(optionA.id)}
            disabled={isDisabled || !optionA}
            aria-label={optionA ? `Pick ${optionA.name} (option A)` : "Loading option A"}
            className={`relative flex flex-col items-center justify-center gap-3 sm:gap-2 p-4 sm:p-8 transition-all duration-200 text-center ${
              isPicking && winnerId === optionA?.id
                ? "bg-green-500/10"
                : isPicking && winnerId && winnerId !== optionA?.id
                ? "bg-red-500/5 opacity-50"
                : isDisabled
                ? "cursor-not-allowed"
                : "hover:bg-accent/5 cursor-pointer active:scale-[0.98]"
            }`}
          >
            {/* Label badge */}
            <span
              className="absolute top-3 left-3 sm:top-2 sm:left-2 w-6 h-6 sm:w-6 sm:h-6 flex items-center justify-center rounded-full bg-muted text-[10px] font-bold text-subtle"
              aria-hidden="true"
            >
              A
            </span>

            {/* Option name — fades during swap */}
            <div className={`${textTransitionClass} ${textOpacityClass}`}>
              {isInitialLoading ? (
                <div className="h-5 w-24 bg-muted/60 rounded animate-pulse" />
              ) : (
                <span className="text-sm sm:text-base font-semibold text-foreground leading-tight px-6">
                  {optionA?.name}
                </span>
              )}
            </div>

            {/* Pick prompt */}
            {!isDisabled && !isInitialLoading && (
              <span className="text-[10px] sm:text-[10px] text-subtle/40 italic">Tap to pick</span>
            )}

            {/* Winner badge */}
            {isPicking && winnerId === optionA?.id && (
              <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs font-bold text-green-600 uppercase">
                Winner!
              </span>
            )}
          </button>

          {/* Right half — Option B */}
          <button
            onClick={() => optionB && submitVote(optionB.id)}
            disabled={isDisabled || !optionB}
            aria-label={optionB ? `Pick ${optionB.name} (option B)` : "Loading option B"}
            className={`relative flex flex-col items-center justify-center gap-3 sm:gap-2 p-4 sm:p-8 transition-all duration-200 text-center ${
              isPicking && winnerId === optionB?.id
                ? "bg-green-500/10"
                : isPicking && winnerId && winnerId !== optionB?.id
                ? "bg-red-500/5 opacity-50"
                : isDisabled
                ? "cursor-not-allowed"
                : "hover:bg-accent/5 cursor-pointer active:scale-[0.98]"
            }`}
          >
            {/* Label badge */}
            <span
              className="absolute top-3 right-3 sm:top-2 sm:right-2 w-6 h-6 sm:w-6 sm:h-6 flex items-center justify-center rounded-full bg-muted text-[10px] font-bold text-subtle"
              aria-hidden="true"
            >
              B
            </span>

            {/* Option name — fades during swap */}
            <div className={`${textTransitionClass} ${textOpacityClass}`}>
              {isInitialLoading ? (
                <div className="h-5 w-24 bg-muted/60 rounded animate-pulse" />
              ) : (
                <span className="text-sm sm:text-base font-semibold text-foreground leading-tight px-6">
                  {optionB?.name}
                </span>
              )}
            </div>

            {/* Pick prompt */}
            {!isDisabled && !isInitialLoading && (
              <span className="text-[10px] sm:text-[10px] text-subtle/40 italic">Tap to pick</span>
            )}

            {/* Winner badge */}
            {isPicking && winnerId === optionB?.id && (
              <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs font-bold text-green-600 uppercase">
                Winner!
              </span>
            )}
          </button>
        </div>

        {/* VS divider (centered overlay) */}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none"
          aria-hidden="true"
        >
          <div className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-background border border-border/80 shadow-sm">
            <span className="text-[10px] sm:text-xs font-bold text-subtle/60 uppercase">VS</span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 py-2">
        <button
          onClick={submitSkip}
          disabled={isDisabled}
          className="px-4 py-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-border/40 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Skip this pair"
        >
          Skip (S)
        </button>
      </div>

      {/* Keyboard legend (desktop only) */}
      <div className="hidden sm:flex items-center justify-center gap-4 text-[10px] text-subtle/50 pb-2">
        <span>Press <kbd className="px-1 py-0.5 rounded border border-border/60 font-mono">1</kbd> or <kbd className="px-1 py-0.5 rounded border border-border/60 font-mono">←</kbd> for A</span>
        <span>•</span>
        <span>Press <kbd className="px-1 py-0.5 rounded border border-border/60 font-mono">2</kbd> or <kbd className="px-1 py-0.5 rounded border border-border/60 font-mono">→</kbd> for B</span>
        <span>•</span>
        <span>Press <kbd className="px-1 py-0.5 rounded border border-border/60 font-mono">S</kbd> to skip</span>
      </div>
    </div>
  );
}
