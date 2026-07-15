"use client";

/**
 * UserArenaVoteHistory — Client component for paginated arena vote history.
 * Shows which option the user picked over which in pairwise arena comparisons.
 */
import { useState, useCallback } from "react";
import Link from "next/link";
import { formatDate } from "@/lib/format-date";

interface ArenaVoteHistoryItem {
  id: string;
  topicTitle: string;
  topicSlug: string;
  winnerName: string;
  loserName: string;
  createdAt: Date | string;
}

interface UserArenaVoteHistoryProps {
  initialItems: ArenaVoteHistoryItem[];
  initialCursor: string | null;
  username: string;
}

export function UserArenaVoteHistory({
  initialItems,
  initialCursor,
  username,
}: UserArenaVoteHistoryProps) {
  const [items, setItems] = useState<ArenaVoteHistoryItem[]>(initialItems);
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
      const res = await fetch(`/api/trpc/users.getArenaVoteHistory?${params.toString()}`);
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

  if (items.length === 0) {
    return <p className="text-sm text-subtle">No arena votes yet.</p>;
  }

  return (
    <div>
      {/* Mobile: card layout */}
      <div className="md:hidden space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="border border-border/60 rounded-lg bg-card/80 p-4 space-y-2"
          >
            <Link
              href={`/topic/${item.topicSlug}?mode=arena`}
              className="text-sm text-accent hover:text-accent truncate transition-colors block"
            >
              {item.topicTitle}
            </Link>
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground/80">
                Picked <span className="font-medium text-foreground">{item.winnerName}</span> over <span className="text-muted-foreground">{item.loserName}</span>
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
        <div className="grid grid-cols-[1fr_1fr_6rem] gap-3 items-center px-4 py-2.5 bg-card border-b border-border/60 text-[11px] uppercase tracking-wider font-medium text-subtle">
          <span>Topic</span>
          <span>Matchup</span>
          <span className="text-right">Date</span>
        </div>

        {/* Table rows */}
        {items.map((item) => (
          <div
            key={item.id}
            className="grid grid-cols-[1fr_1fr_6rem] gap-3 items-center px-4 py-2.5 border-b border-border/40 last:border-b-0 hover:bg-muted/20 transition-colors duration-100"
          >
            <Link
              href={`/topic/${item.topicSlug}?mode=arena`}
              className="text-sm text-accent hover:text-accent truncate transition-colors"
            >
              {item.topicTitle}
            </Link>
            <span className="text-sm text-foreground/80 truncate">
              Picked <span className="font-medium text-foreground">{item.winnerName}</span> over <span className="text-muted-foreground">{item.loserName}</span>
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
