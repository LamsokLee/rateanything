"use client";

/**
 * Search page — client-side search with query parameter persistence.
 * Wrapped in Suspense to prevent prerender errors from useSearchParams.
 */
import { Suspense } from "react";
import SearchPageContent from "./SearchPageContent";
import { SearchPageSkeleton } from "@/components/Skeleton";

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchPageSkeleton />}>
      <SearchPageContent />
    </Suspense>
  );
}
