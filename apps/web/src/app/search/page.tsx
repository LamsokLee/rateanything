"use client";

/**
 * Search page — client-side search with query parameter persistence.
 * Wrapped in Suspense to prevent prerender errors from useSearchParams.
 */
import { Suspense } from "react";
import SearchPageContent from "./SearchPageContent";

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchPageSkeleton />}>
      <SearchPageContent />
    </Suspense>
  );
}

function SearchPageSkeleton() {
  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-2 text-xs text-subtle">
        <span>Home</span>
        <span>&rsaquo;</span>
        <span className="text-foreground/80 font-medium">Search</span>
      </nav>
      <header className="space-y-3">
        <h1 className="text-xl font-bold text-foreground title-editorial">Search</h1>
        <div className="w-full rounded-lg bg-muted/50 h-11 animate-pulse" />
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 rounded-lg bg-muted/50 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
