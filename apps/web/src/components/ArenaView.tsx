"use client";

/**
 * ArenaView — Pairwise comparison UI for Arena mode.
 *
 * Renders two option cards side-by-side on all screen sizes.
 * Users pick a winner via:
 *   - Tap/click on a card (primary interaction)
 *   - Swipe left/right on the arena surface (Tinder-style drag with fly-off)
 *   - Keyboard: 1/2 keys or ArrowLeft/ArrowRight
 *
 * State flow:
 *   idle → picking (user taps/swipes) → submitting (winner shown optimistically)
 *        → revealing (vote confirmed) → idle (next pair)
 *
 * Non-obvious logic:
 *   - Swipe detection uses pointer events on the container. Cards translate and
 *     rotate with the finger, giving tactile feedback. Release past threshold
 *     triggers a fly-off animation + vote.
 *   - Winner badge is shown immediately on tap, before the server responds.
 *   - Next pair is fetched in parallel with the reveal timer.
 */
import { useState, useCallback, useRef, useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { Skeleton } from "./Skeleton";

/** Minimum horizontal distance (px) to trigger a vote on swipe release */
const SWIPE_THRESHOLD = 80;
/** Maximum rotation (degrees) at full swipe */
const MAX_ROTATION = 12;
/** Time to show result before loading next pair (ms) */
const REVEAL_DURATION = 600;
/** Fly-off animation duration (ms) */
const FLY_OFF_DURATION = 300;

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

type FlyOffDir = "left" | "right" | null;

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

  // Swipe / drag state
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [flyOffDir, setFlyOffDir] = useState<FlyOffDir>(null);

  const pointerStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragXRef = useRef(0);
  const isDraggingRef = useRef(false);

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
    setDragX(0);
    setFlyOffDir(null);
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

  /** Keyboard handler */
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
   * Pointer drag handlers for Tinder-style swipe.
   * Tracks horizontal movement, applies translation + rotation to cards.
   */
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (state !== "idle") return;
    pointerStartRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
    isDraggingRef.current = true;
    setIsDragging(true);
    // Capture pointer so move/up events fire even if finger leaves the element
    // (guard for jsdom where setPointerCapture is missing)
    const el = e.currentTarget as HTMLElement;
    if (el.setPointerCapture && e.pointerId != null) {
      el.setPointerCapture(e.pointerId);
    }
  }, [state]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDraggingRef.current || !pointerStartRef.current) return;

    const dx = e.clientX - pointerStartRef.current.x;
    const dy = e.clientY - pointerStartRef.current.y;

    // Ignore if vertical movement dominates (scrolling)
    if (Math.abs(dy) > Math.abs(dx) * 1.5) {
      isDraggingRef.current = false;
      setIsDragging(false);
      setDragX(0);
      return;
    }

    dragXRef.current = dx;
    setDragX(dx);
  }, []);

  const handlePointerUp = useCallback(
    (_e: React.PointerEvent) => {
      if (!isDraggingRef.current || !pointerStartRef.current) return;
      isDraggingRef.current = false;
      setIsDragging(false);

      const dx = dragXRef.current;
      const dt = Date.now() - pointerStartRef.current.time;
      const absDx = Math.abs(dx);
      const velocity = dt > 0 ? absDx / dt : 0;
      pointerStartRef.current = null;

      // Trigger vote if threshold OR velocity is high enough
      if (absDx >= SWIPE_THRESHOLD || (absDx >= 40 && velocity >= 0.5)) {
        const dir: FlyOffDir = dx < 0 ? "left" : "right";
        setFlyOffDir(dir);
        setDragX(dx * 3); // Exaggerate for fly-off

        // After fly-off animation, submit the vote
        setTimeout(() => {
          if (dir === "left" && optionA) {
            submitVote(optionA.id);
          } else if (dir === "right" && optionB) {
            submitVote(optionB.id);
          }
        }, FLY_OFF_DURATION);
      } else {
        // Snap back
        setDragX(0);
      }
    },
    [optionA, optionB, submitVote]
  );

  // --- Render helpers ---

  const isRevealing = state === "revealing";
  const isSubmitting = state === "submitting";
  const isDisabled = isRevealing || isSubmitting || flyOffDir !== null;
  const hasVoteResult = voteResult !== null;

  // Compute card transforms
  const rotation = Math.max(-MAX_ROTATION, Math.min(MAX_ROTATION, (dragX / 200) * MAX_ROTATION));
  const transformStyle = flyOffDir
    ? `translateX(${dragX}px) rotate(${rotation}deg)`
    : isDragging
    ? `translateX(${dragX}px) rotate(${rotation}deg)`
    : dragX !== 0
    ? `translateX(0px) rotate(0deg)`
    : undefined;
  const transitionStyle = flyOffDir
    ? `transform ${FLY_OFF_DURATION}ms ease-out, opacity ${FLY_OFF_DURATION}ms ease-out`
    : isDragging
    ? undefined
    : "transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)";

  // Swipe overlay opacity (peek labels)
  const leftOpacity = Math.min(1, Math.max(0, -dragX / 120));
  const rightOpacity = Math.min(1, Math.max(0, dragX / 120));

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

      {/* Swipe instruction */}
      <div className="flex items-center justify-center text-[10px] text-subtle/50 sm:hidden">
        <span aria-hidden="true">← swipe left for A • swipe right for B →</span>
      </div>

      {/* Arena cards container — swipeable surface */}
      <div
        ref={containerRef}
        className="relative grid grid-cols-2 gap-2 sm:gap-4 select-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        role="group"
        aria-label="Choose between two options. Swipe left for A, right for B."
      >
        {/* Swipe peek labels */}
        {isDragging && !flyOffDir && (
          <>
            <div
              className="absolute inset-0 z-20 flex items-center justify-start pl-4 pointer-events-none"
              style={{ opacity: leftOpacity }}
            >
              <span className="text-2xl font-black text-green-500 uppercase tracking-wider rotate-[-12deg] border-4 border-green-500 rounded-lg px-2 py-1">
                A
              </span>
            </div>
            <div
              className="absolute inset-0 z-20 flex items-center justify-end pr-4 pointer-events-none"
              style={{ opacity: rightOpacity }}
            >
              <span className="text-2xl font-black text-green-500 uppercase tracking-wider rotate-[12deg] border-4 border-green-500 rounded-lg px-2 py-1">
                B
              </span>
            </div>
          </>
        )}

        {/* Option A card */}
        {optionA && (
          <div
            className="relative"
            style={{
              transform: transformStyle,
              transition: transitionStyle,
              opacity: flyOffDir === "right" ? 0.3 : 1,
            }}
          >
            <ArenaCard
              option={optionA}
              label="A"
              keyHint="1"
              onPick={() => submitVote(optionA.id)}
              disabled={isDisabled}
              isWinner={(isRevealing || isSubmitting) && hasVoteResult && voteResult!.winnerId === optionA.id}
              isLoser={(isRevealing || isSubmitting) && hasVoteResult && voteResult!.winnerId !== optionA.id}
            />
          </div>
        )}

        {/* Option B card */}
        {optionB && (
          <div
            className="relative"
            style={{
              transform: transformStyle,
              transition: transitionStyle,
              opacity: flyOffDir === "left" ? 0.3 : 1,
            }}
          >
            <ArenaCard
              option={optionB}
              label="B"
              keyHint="2"
              onPick={() => submitVote(optionB.id)}
              disabled={isDisabled}
              isWinner={(isRevealing || isSubmitting) && hasVoteResult && voteResult!.winnerId === optionB.id}
              isLoser={(isRevealing || isSubmitting) && hasVoteResult && voteResult!.winnerId !== optionB.id}
            />
          </div>
        )}
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
      className={`relative flex flex-col items-center justify-center gap-2 p-3 sm:p-8 rounded-xl border-2 transition-all duration-200 text-left w-full min-h-[100px] sm:min-h-[160px] ${
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
        className="absolute top-2 left-2 w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center rounded-full bg-muted text-[9px] sm:text-[10px] font-bold text-subtle"
        aria-hidden="true"
      >
        {label}
      </span>

      {/* Keyboard hint (desktop only) */}
      <span
        className="absolute top-2 right-2 hidden sm:flex items-center justify-center px-1.5 py-0.5 rounded border border-border/60 text-[9px] font-mono text-subtle/50"
        aria-hidden="true"
      >
        {keyHint}
      </span>

      {/* Option name */}
      <span className="text-xs sm:text-base font-semibold text-foreground text-center leading-tight px-6">
        {option.name}
      </span>

      {/* Pick prompt — hidden after vote */}
      {!isWinner && !isLoser && (
        <span className="text-[9px] sm:text-[10px] text-subtle/40 italic">Tap to pick</span>
      )}

      {/* Winner badge on reveal */}
      {isWinner && (
        <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] sm:text-xs font-bold text-green-600 uppercase">
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
      <div className="grid grid-cols-2 gap-2 sm:gap-4">
        <div className="flex flex-col items-center justify-center gap-2 p-3 sm:p-8 rounded-xl border-2 border-border/40 bg-card/60 min-h-[100px] sm:min-h-[160px]">
          <Skeleton className="h-4 sm:h-5 w-24 sm:w-32" />
        </div>
        <div className="flex flex-col items-center justify-center gap-2 p-3 sm:p-8 rounded-xl border-2 border-border/40 bg-card/60 min-h-[100px] sm:min-h-[160px]">
          <Skeleton className="h-4 sm:h-5 w-24 sm:w-32" />
        </div>
      </div>
      <div className="flex items-center justify-center">
        <Skeleton className="h-8 w-20 rounded-md" />
      </div>
    </div>
  );
}
