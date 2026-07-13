"use client";

/**
 * InlineRatingButtons — Compact 1-10 vote buttons for table rows.
 * w-7 h-7, no hover labels, no sparkline, no gradient bar.
 * Highlighted number = user vote (accent blue fill).
 * After clicking: number fills, row briefly flashes to confirm.
 * Calls tRPC ratings.submit with auth header for persistence.
 * Fetches guest ratings client-side after mount (server can't read fingerprint).
 */
import { useState, useCallback, useEffect } from "react";
import { useAuth } from "./AuthProvider";

interface InlineRatingButtonsProps {
  optionId: string;
  currentUserRating: number | null;
  onVoteSuccess?: () => void;
  onScoreUpdate?: (avgRating: number, ratingCount: number) => void;
}

export function InlineRatingButtons({
  optionId,
  currentUserRating,
  onVoteSuccess,
  onScoreUpdate,
}: InlineRatingButtonsProps) {
  const { user, isLoading: authLoading } = useAuth();
  const [userRating, setUserRating] = useState<number | null>(currentUserRating);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [justVoted, setJustVoted] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setUserRating(currentUserRating);
  }, [currentUserRating]);

  // Fetch user or guest rating client-side after mount (server can't read auth cookies)
  useEffect(() => {
    if (mounted || authLoading) return;

    if (currentUserRating !== null) {
      setMounted(true);
      return;
    }

    if (user) {
      // Fetch authenticated user rating via API
      fetchMyRating(optionId)
        .then((rating) => {
          if (rating !== null) setUserRating(rating);
        })
        .catch(() => {/* ignore */})
        .finally(() => setMounted(true));
    } else if (typeof window !== "undefined") {
      const fingerprint = getFingerprint();
      fetchGuestRating(optionId, fingerprint)
        .then((rating) => {
          if (rating !== null) setUserRating(rating);
        })
        .catch(() => {/* ignore */})
        .finally(() => setMounted(true));
    } else {
      setMounted(true);
    }
  }, [optionId, user, authLoading, currentUserRating, mounted]);

  const handleRate = useCallback(
    async (score: number) => {
      if (isSubmitting) return;

      // --- Toggle-off: clicking the currently-selected score cancels the rating ---
      if (score === userRating) {
        const prevRating = userRating;
        setUserRating(null);
        setIsSubmitting(true);

        try {
          const payload: { optionId: string; guestFingerprint?: string } = { optionId };
          if (!user) {
            payload.guestFingerprint = getFingerprint();
          }

          const res = await fetch("/api/trpc/ratings.remove", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ json: payload }),
          });

          if (!res.ok) {
            // Rollback on failure
            setUserRating(prevRating);
          } else {
            // Parse response to get updated avg/count
            const resBody = await res.json().catch(() => null);
            const data = resBody?.result?.data?.json;
            if (data && typeof data.optionAvgRating === "number" && typeof data.optionRatingCount === "number") {
              onScoreUpdate?.(data.optionAvgRating, data.optionRatingCount);
            }
            setJustVoted(false);
            onVoteSuccess?.();
          }
        } catch {
          // Rollback on network error
          setUserRating(prevRating);
        } finally {
          setIsSubmitting(false);
        }
        return;
      }
      // --- End toggle-off branch ---

      const prevRating = userRating;
      setUserRating(score);
      setIsSubmitting(true);

      try {
        // Build payload — include guestFingerprint for unauthenticated users
        const payload: { optionId: string; score: number; guestFingerprint?: string } = {
          optionId,
          score,
        };
        if (!user) {
          payload.guestFingerprint = getFingerprint();
        }

        const res = await fetch("/api/trpc/ratings.submit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ json: payload }),
        });

        if (!res.ok) {
          // Check if this is the guest topic limit error
          const errBody = await res.json().catch(() => null);
          const errMsg = errBody?.error?.json?.message ?? errBody?.error?.message ?? "";
          if (!user && errMsg.includes("3 topics")) {
            setShowAuthPrompt(true);
            setTimeout(() => setShowAuthPrompt(false), 3000);
          }
          setUserRating(prevRating);
        } else {
          // Parse response to get updated avg/count from mutation result
          const resBody = await res.json().catch(() => null);
          const data = resBody?.result?.data?.json;
          if (data && typeof data.optionAvgRating === "number" && typeof data.optionRatingCount === "number") {
            onScoreUpdate?.(data.optionAvgRating, data.optionRatingCount);
          }
          setJustVoted(true);
          setTimeout(() => setJustVoted(false), 800);
          onVoteSuccess?.();
        }
      } catch {
        setUserRating(prevRating);
      } finally {
        setIsSubmitting(false);
      }
    },
    [optionId, userRating, isSubmitting, onVoteSuccess, onScoreUpdate, user]
  );

  return (
    <div className="relative">
      <div
        className={`flex items-center gap-0.5 transition-colors duration-300 rounded px-1 py-0.5 ${
          justVoted ? "bg-accent/10" : ""
        }`}
      >
        {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => {
          const isSelected = userRating === num;
          return (
            <button
              key={num}
              onClick={() => handleRate(num)}
              disabled={isSubmitting}
              aria-label={`Rate ${num} out of 10`}
              className={`w-7 h-7 rounded text-[11px] font-mono font-semibold transition-all duration-150 flex items-center justify-center ${
                isSelected
                  ? "bg-accent text-accent-foreground"
                  : "text-subtle hover:text-foreground hover:bg-muted-foreground/50"
              } ${isSubmitting ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
            >
              {num}
            </button>
          );
        })}
      </div>
      {showAuthPrompt && (
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-muted border border-input px-2 py-1 text-[10px] text-foreground/80 z-10">
          Guests can rate 3 topics &mdash; sign in to rate more
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
