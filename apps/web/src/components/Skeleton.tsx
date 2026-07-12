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
    <div className="flex items-center gap-4 px-4 py-3">
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <div className="flex gap-2">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <Skeleton className="h-4 w-12" />
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
