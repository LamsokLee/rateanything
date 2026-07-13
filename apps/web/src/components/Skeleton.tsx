"use client";

/**
 * Skeleton — shimmer loading placeholders for content loading states.
 */

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded bg-muted ${className}`}
      aria-hidden="true"
    />
  );
}

export function TopicCardSkeleton() {
  return (
    <div className="border border-border rounded-lg bg-card p-4 space-y-3 overflow-hidden">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Skeleton className="h-5 w-14 rounded" />
          <Skeleton className="h-5 w-16 rounded" />
        </div>
      </div>
      <Skeleton className="h-4 w-3/4" />
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 flex-1" />
          <Skeleton className="h-3 w-7" />
          <Skeleton className="h-[3px] w-16" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 flex-1" />
          <Skeleton className="h-3 w-7" />
          <Skeleton className="h-[3px] w-16" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 flex-1" />
          <Skeleton className="h-3 w-7" />
          <Skeleton className="h-[3px] w-16" />
        </div>
      </div>
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

export function OptionCardSkeleton() {
  return (
    <div className="border border-border rounded-lg bg-card p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="w-7 h-7 rounded-full" />
        <Skeleton className="h-4 flex-1 max-w-[200px]" />
        <Skeleton className="h-8 w-12" />
      </div>
      <Skeleton className="h-[3px] w-full" />
      <div className="flex gap-0.5">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-8" />
        ))}
      </div>
    </div>
  );
}

export function RatingButtonsSkeleton() {
  return (
    <div className="flex items-center gap-0.5 rounded px-1 py-0.5">
      {Array.from({ length: 10 }).map((_, i) => (
        <Skeleton key={i} className="w-7 h-7 rounded" />
      ))}
    </div>
  );
}

export function CommentSkeleton({ isReply = false }: { isReply?: boolean }) {
  return (
    <div
      className={`rounded-lg border border-border/40 bg-card/80 p-3 space-y-2 ${
        isReply ? "text-xs" : "text-sm"
      }`}
    >
      <div className="flex items-center gap-2">
        <Skeleton className={`rounded-full ${isReply ? "w-5 h-5" : "w-6 h-6"}`} />
        <Skeleton className={`h-3 w-24 ${isReply ? "h-2.5" : ""}`} />
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-3/4" />
      <div className="flex items-center gap-3 pt-1">
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

export function HomePageSkeleton() {
  return (
    <div className="space-y-6">
      <header className="pt-2 pb-4 space-y-1">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
      </header>

      <div className="sticky top-[57px] z-40 bg-background/95 backdrop-blur-sm border-b border-border/50 -mx-4 px-4">
        <nav className="flex items-center gap-5 overflow-x-auto scrollbar-hide py-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-16 rounded shrink-0" />
          ))}
        </nav>
      </div>

      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-10 rounded-full" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <TopicCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export function TopicPageSkeleton() {
  return (
    <div className="space-y-6">
      <header className="border border-border/60 rounded-xl bg-card/60 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
          <div className="space-y-2 min-w-0 flex-1">
            <Skeleton className="h-7 sm:h-8 w-3/4 max-w-xl" />
            <Skeleton className="h-4 w-2/3 max-w-lg" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full shrink-0" />
        </div>
        <div className="mt-4 flex items-center gap-3 flex-wrap border-t border-border/40 pt-3">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-1.5 rounded-full" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-1.5 rounded-full" />
          <Skeleton className="h-3 w-24" />
        </div>
      </header>

      <section className="border border-border/60 rounded-xl bg-card/60 overflow-hidden">
        <div className="px-5 py-4 border-b border-border/60 bg-card/80">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>

        <div className="md:hidden divide-y divide-border/40">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="w-6 h-6 rounded-full" />
                <Skeleton className="h-2.5 w-2.5 rounded-full" />
                <Skeleton className="h-4 flex-1 max-w-[180px]" />
              </div>
              <div className="pl-9 flex items-center gap-3">
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-8 w-20" />
              </div>
              <div className="pl-9">
                <RatingButtonsSkeleton />
              </div>
            </div>
          ))}
        </div>

        <div className="hidden md:block">
          <div className="grid grid-cols-[2.5rem_1fr_5rem_6rem_19.5rem] gap-3 items-center px-5 py-3 bg-card/80 border-b border-border/60">
            <Skeleton className="h-3 w-3 justify-self-center" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-8 justify-self-end" />
            <Skeleton className="h-3 w-10 justify-self-end" />
            <Skeleton className="h-3 w-24 justify-self-center" />
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-[2.5rem_1fr_5rem_6rem_19.5rem] gap-3 items-center px-5 py-3.5 border-b border-border/30 last:border-b-0"
            >
              <Skeleton className="h-5 w-5 rounded-full justify-self-center" />
              <div className="flex items-center gap-2.5 min-w-0">
                <Skeleton className="h-2.5 w-2.5 rounded-full shrink-0" />
                <Skeleton className="h-4 w-32" />
              </div>
              <div className="space-y-1 justify-self-end">
                <Skeleton className="h-4 w-8 ml-auto" />
                <Skeleton className="h-2.5 w-10 ml-auto" />
              </div>
              <Skeleton className="h-8 w-16 justify-self-end" />
              <div className="justify-self-center">
                <RatingButtonsSkeleton />
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="border border-border/60 rounded-xl bg-card/90 p-5 space-y-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>

      <section className="border border-border/60 rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-6 w-28 rounded-lg" />
        </div>
        <Skeleton className="h-20 w-full rounded-lg" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <CommentSkeleton key={i} />
          ))}
        </div>
      </section>
    </div>
  );
}

export function CategoryPageSkeleton() {
  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-2 text-xs text-subtle">
        <Skeleton className="h-3 w-8" />
        <span>&rsaquo;</span>
        <Skeleton className="h-3 w-24" />
      </nav>

      <header className="space-y-1">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-32" />
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <TopicCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export function UserProfilePageSkeleton() {
  return (
    <div className="space-y-6">
      <header className="border-b border-border/60 pb-5 space-y-3">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 sm:w-12 sm:h-12 rounded-full" />
          <div className="space-y-2 min-w-0">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-1.5 rounded-full" />
          <Skeleton className="h-3 w-24" />
        </div>
      </header>

      <section className="space-y-4">
        <div className="flex items-center gap-1 rounded bg-muted/80 p-0.5 border border-input/50 w-fit">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-20 rounded" />
          ))}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-lg border border-border/40 bg-card/80 p-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function CreatePageSkeleton() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-64" />
      </header>

      <div className="rounded-lg border border-border/60 bg-card/50 p-5 sm:p-6 space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        </div>
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>
    </div>
  );
}

export function SearchPageSkeleton() {
  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-2 text-xs text-subtle">
        <Skeleton className="h-3 w-8" />
        <span>&rsaquo;</span>
        <Skeleton className="h-3 w-12" />
      </nav>
      <header className="space-y-3">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-11 w-full rounded-lg" />
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <TopicCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
