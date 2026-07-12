"use client";

/**
 * Search page content — client-side search with query parameter persistence.
 * Calls the tRPC search endpoint and shows results in a TopicCard grid.
 */
import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { TopicCard } from "@/components/TopicCard";

interface SearchResult {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  totalRatings: number;
  trendingScore: number | null;
  createdAt: Date | string;
  categoryName: string | null;
  categorySlug: string | null;
  creatorUsername: string | null;
  creatorAvatarUrl: string | null;
  topOptions?: { name: string; avgRating: number }[];
  optionCount?: number;
}

export default function SearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(initialQuery.length > 0);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    setHasSearched(true);

    try {
      const params = new URLSearchParams();
      params.set("input", JSON.stringify({
        json: { query: searchQuery.trim(), limit: 20 },
      }));

      const res = await fetch(`/api/trpc/topics.search?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const result = data.result?.data?.json;
        if (result) {
          setResults(result.topics);
        }
      }
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Search on initial load if query param exists
  useEffect(() => {
    if (initialQuery.length >= 2) {
      performSearch(initialQuery);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      performSearch(query.trim());
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-subtle">
        <Link href="/" className="hover:text-foreground/80 transition-colors">
          Home
        </Link>
        <span>&rsaquo;</span>
        <span className="text-foreground/80 font-medium">Search</span>
      </nav>

      {/* Header */}
      <header className="space-y-3">
        <h1 className="text-xl font-bold text-foreground title-editorial">
          Search
        </h1>

        <form onSubmit={handleSubmit} className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search topics..."
            className="w-full rounded-lg border border-input bg-muted/50 px-4 py-3 text-sm text-foreground placeholder-subtle focus:outline-none focus:border-subtle transition-colors"
            autoFocus
          />
          <button
            type="submit"
            disabled={isLoading || query.length < 2}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "..." : "Search"}
          </button>
        </form>
      </header>

      {/* Results */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 rounded-lg bg-muted/50 animate-pulse" />
          ))}
        </div>
      ) : hasSearched ? (
        results.length === 0 ? (
          <div className="border border-border rounded-lg bg-card p-8 text-center">
            <p className="text-sm text-subtle">
              No topics found for <span className="font-mono text-muted-foreground">"{query}"</span>
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-subtle">
                Results
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold font-mono bg-accent/10 text-accent">
                {results.length}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {results.map((topic, idx) => (
                <TopicCard
                  key={topic.id}
                  topic={topic}
                  featured={idx === 0}
                />
              ))}
            </div>
          </>
        )
      ) : (
        <div className="border border-border rounded-lg bg-card p-8 text-center">
          <p className="text-sm text-subtle">
            Type at least 2 characters to search for topics
          </p>
        </div>
      )}
    </div>
  );
}
