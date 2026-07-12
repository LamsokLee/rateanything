"use client";

/**
 * UserRatingHistory — Client component for paginated rating history table.
 * Shows topic, option, score, and date with a "Load more" button.
 */
import { useState, useCallback } from "react";
import Link from "next/link";

interface RatingHistoryItem {
  topicTitle: string;
  topicSlug: string;
  optionName: string;
  score: number;
  createdAt: Date | string;
}

interface UserRatingHistoryProps {
  initialItems: RatingHistoryItem[];
  initialCursor: string | null;
  username: string;
}

function formatDate(dateInput: Date | string): string {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function UserRatingHistory({
  initialItems,
  initialCursor,
  username,
}: UserRatingHistoryProps) {
  const [items, setItems] = useState<RatingHistoryItem[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [isLoading, setIsLoading] = useState(false);

  const loadMore = useCallback(async () => {
    if (!cursor || isLoading) return;
    setIsLoading(true);

    try {
      const params = new URLSearchParams();
      params.set("input", JSON.stringify({
        json: { username, cursor, limit: 20 },
      }));
      const res = await fetch(`/api/trpc/users.getRatingHistory?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const result = data.result?.data?.json;
        if (result) {
          setItems((prev) => [...prev, ...result.items]);
          setCursor(result.nextCursor);
        }
      }
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false);
    }
  }, [cursor, isLoading, username]);

  return (
    <div>
      {/* Mobile: card layout */}
      <div className="md:hidden space-y-3">
        {items.map((item, index) => (
          <div
            key={`${item.topicSlug}-${item.optionName}-${index}`}
            className="border border-border/60 rounded-lg bg-card/80 p-4 space-y-2"
          >
            <div className="flex items-center justify-between">
              <Link
                href={`/topic/${item.topicSlug}`}
                className="text-sm text-accent hover:text-accent truncate transition-colors max-w-[70%]"
              >
                {item.topicTitle}
              </Link>
              <span className="text-right font-mono text-sm font-semibold text-foreground">
                {item.score}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground/80">
                {item.optionName}
              </span>
              <span className="text-[11px] text-subtle">
                {formatDate(item.createdAt)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: table layout */}
      <div className="hidden md:block border border-border/60 rounded-lg overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_1fr_4rem_6rem] gap-3 items-center px-4 py-2.5 bg-card border-b border-border/60 text-[11px] uppercase tracking-wider font-medium text-subtle">
          <span>Topic</span>
          <span>Option</span>
          <span className="text-right">Score</span>
          <span className="text-right">Date</span>
        </div>

        {/* Table rows */}
        {items.map((item, index) => (
          <div
            key={`${item.topicSlug}-${item.optionName}-${index}`}
            className="grid grid-cols-[1fr_1fr_4rem_6rem] gap-3 items-center px-4 py-2.5 border-b border-border/40 last:border-b-0 hover:bg-muted/20 transition-colors duration-100"
          >
            <Link
              href={`/topic/${item.topicSlug}`}
              className="text-sm text-accent hover:text-accent truncate transition-colors"
            >
              {item.topicTitle}
            </Link>
            <span className="text-sm text-foreground/80 truncate">
              {item.optionName}
            </span>
            <span className="text-right font-mono text-sm font-semibold text-foreground">
              {item.score}
            </span>
            <span className="text-right text-[11px] text-subtle">
              {formatDate(item.createdAt)}
            </span>
          </div>
        ))}
      </div>

      {cursor && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={loadMore}
            disabled={isLoading}
            className="rounded bg-muted border border-input px-4 py-2 text-xs font-medium text-foreground/80 hover:bg-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            {isLoading ? "Loading..." : "Load More"}
          </button>
        </div>
      )}
    </div>
  );
}
