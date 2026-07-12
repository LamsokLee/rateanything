"use client";

/**
 * RatingButtons — Round circle voting buttons (1-10) with gradient score bar
 * and per-option mini sparkline showing score trend.
 * Fetches guest ratings client-side after mount (server can't read fingerprint).
 */
import { useState, useCallback, useEffect, useRef } from "react";
import { Sparkline } from "@/components/Sparkline";
import { useAuth } from "./AuthProvider";

interface RatingButtonsProps {
  optionId: string;
  currentUserRating: number | null;
  avgRating: number;
  ratingCount: number;
  historyData?: number[];
  historyColor?: string;
}

function getScoreLabel(score: number): string {
  if (score <= 2) return "Terrible";
  if (score <= 4) return "Below Average";
  if (score <= 6) return "Average";
  if (score <= 8) return "Great";
  return "Excellent";
}

export function RatingButtons({
  optionId,
  currentUserRating,
  avgRating,
  ratingCount,
  historyData,
  historyColor = "#3b82f6",
}: RatingButtonsProps) {
  const { user, isLoading: authLoading } = useAuth();
  const [userRating, setUserRating] = useState<number | null>(currentUserRating);
  const [displayAvg, setDisplayAvg] = useState(avgRating);
  const [displayCount, setDisplayCount] = useState(ratingCount);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scoreFlash, setScoreFlash] = useState<"up" | "down" | null>(null);
  const [hoveredScore, setHoveredScore] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const prevAvgRef = useRef(avgRating);
  const fetchedRef = useRef(false);

  // Sync prop changes (e.g. when server data refreshes)
  useEffect(() => {
    setUserRating(currentUserRating);
  }, [currentUserRating]);

  // Fetch user or guest rating client-side after mount (server can't read auth cookies)
  useEffect(() => {
    if (fetchedRef.current) return;
    if (authLoading) return;

    if (currentUserRating !== null) {
      fetchedRef.current = true;
      return;
    }

    if (user) {
      fetchMyRating(optionId)
        .then((rating) => {
          if (rating !== null) setUserRating(rating);
        })
        .catch(() => {/* ignore */})
        .finally(() => {
          fetchedRef.current = true;
        });
    } else if (typeof window !== "undefined") {
      const fingerprint = getFingerprint();
      fetchGuestRating(optionId, fingerprint)
        .then((rating) => {
          if (rating !== null) setUserRating(rating);
        })
        .catch(() => {/* ignore */})
        .finally(() => {
          fetchedRef.current = true;
        });
    } else {
      fetchedRef.current = true;
    }
  }, [optionId, user, authLoading, currentUserRating]);

  // Animate score flash when displayAvg changes
  useEffect(() => {
    if (displayAvg !== prevAvgRef.current) {
      if (displayAvg > prevAvgRef.current) {
        setScoreFlash("up");
      } else if (displayAvg < prevAvgRef.current) {
        setScoreFlash("down");
      }
      prevAvgRef.current = displayAvg;
      const timer = setTimeout(() => setScoreFlash(null), 600);
      return () => clearTimeout(timer);
    }
  }, [displayAvg]);

  const handleRate = useCallback(
    async (score: number) => {
      if (isSubmitting) return;

      // Clicking the same score again does nothing
      if (score === userRating) return;

      const isUpdate = userRating !== null;
      const prevRating = userRating;
      const prevAvg = displayAvg;
      const prevCount = displayCount;

      // Optimistic update
      let newCount = displayCount;
      let newAvg = displayAvg;

      if (prevRating === null) {
        newCount = displayCount + 1;
        newAvg = (displayAvg * displayCount + score) / newCount;
      } else {
        newAvg =
          displayCount > 0
            ? (displayAvg * displayCount - prevRating + score) / displayCount
            : score;
      }

      setUserRating(score);
      setDisplayAvg(newAvg);
      setDisplayCount(newCount);
      setIsSubmitting(true);

      try {
        const res = await fetch("/api/trpc/ratings.submit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            json: {
              optionId,
              score,
              guestFingerprint: getFingerprint(),
            },
          }),
        });

        if (!res.ok) {
          setUserRating(prevRating);
          setDisplayAvg(prevAvg);
          setDisplayCount(prevCount);
        } else {
          // Show feedback
          setFeedback(isUpdate ? "Updated ✓" : "Voted!");
          setTimeout(() => setFeedback(null), 2000);
        }
      } catch {
        setUserRating(prevRating);
        setDisplayAvg(prevAvg);
        setDisplayCount(prevCount);
      } finally {
        setIsSubmitting(false);
      }
    },
    [optionId, userRating, displayAvg, displayCount, isSubmitting]
  );

  const barPercentage = displayAvg > 0 ? (displayAvg / 10) * 100 : 0;

  return (
    <div className="space-y-3">
      {/* Gradient score bar (red to green) */}
      <div className="relative w-full h-[6px] bg-muted rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${barPercentage}%`,
            background: "linear-gradient(90deg, #ef4444, #eab308, #22c55e)",
          }}
        />
      </div>

      {/* Hover label / feedback */}
      <div className="h-4 flex items-center">
        {feedback && (
          <span className="text-[11px] font-medium text-green-400 transition-opacity duration-150">
            {feedback}
          </span>
        )}
        {!feedback && hoveredScore !== null && (
          <span className="text-[11px] font-medium text-foreground/80 transition-opacity duration-150">
            {hoveredScore}/10 — {getScoreLabel(hoveredScore)}
          </span>
        )}
        {!feedback && hoveredScore === null && userRating !== null && (
          <span className="text-[11px] text-subtle">
            Your vote: <span className="font-mono font-semibold text-foreground/80">{userRating}</span>
          </span>
        )}
      </div>

      {/* Round circle buttons — mobile compact, desktop full */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1 sm:gap-1.5 flex-wrap">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => {
            const isSelected = userRating === num;
            return (
              <button
                key={num}
                onClick={() => handleRate(num)}
                onMouseEnter={() => setHoveredScore(num)}
                onMouseLeave={() => setHoveredScore(null)}
                disabled={isSubmitting}
                aria-label={`Rate ${num} out of 10 — ${getScoreLabel(num)}`}
                className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full text-[11px] sm:text-xs font-mono font-semibold border transition-all duration-150 flex items-center justify-center ${
                  isSelected
                    ? "border-accent text-accent-foreground bg-accent"
                    : "border-input text-muted-foreground hover:border-muted-foreground hover:text-foreground hover:bg-muted/50"
                } ${isSubmitting ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              >
                {isSelected ? "✓" : num}
              </button>
            );
          })}
        </div>

        {/* Score display */}
        <div className="flex flex-col items-center ml-2 sm:ml-3 shrink-0">
          <span
            className={`text-base sm:text-lg font-mono font-bold transition-colors duration-200 ${
              scoreFlash === "up"
                ? "text-green-400"
                : scoreFlash === "down"
                  ? "text-red-400"
                  : "text-foreground"
            }`}
          >
            {displayAvg > 0 ? displayAvg.toFixed(1) : "\u2014"}
          </span>
          <span className="text-[10px] text-subtle font-mono">
            {displayCount} {displayCount === 1 ? "vote" : "votes"}
          </span>
        </div>
      </div>

      {/* Per-option mini sparkline */}
      {historyData && historyData.length >= 2 && (
        <div className="pt-1">
          <Sparkline
            data={historyData}
            color={historyColor}
            width={320}
            height={40}
            strokeWidth={1.5}
            className="w-full max-w-xs opacity-60"
          />
        </div>
      )}
    </div>
  );
}

/** Fetch authenticated user rating for an option via tRPC */
async function fetchMyRating(optionId: string): Promise<number | null> {
  try {
    const res = await fetch(`/api/trpc/ratings.getMyRating?input=${encodeURIComponent(JSON.stringify({ json: { optionId } }))}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.result?.data?.json?.score ?? null;
  } catch {
    return null;
  }
}

/** Fetch guest rating for an option by fingerprint */
async function fetchGuestRating(optionId: string, fingerprint: string): Promise<number | null> {
  try {
    const res = await fetch(`/api/trpc/ratings.getForGuest?input=${encodeURIComponent(JSON.stringify({ json: { optionId, fingerprint } }))}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.result?.data?.json?.score ?? null;
  } catch {
    return null;
  }
}

/** Simple browser fingerprint for guest ratings */
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
