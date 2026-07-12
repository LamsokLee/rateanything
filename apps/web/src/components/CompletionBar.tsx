"use client";

/**
 * CompletionBar — Gamification hint showing "X/Y options rated"
 * as a mini progress bar. Motivates rating ALL options.
 */

interface CompletionBarProps {
  rated: number;
  total: number;
}

export function CompletionBar({ rated, total }: CompletionBarProps) {
  if (total === 0) return null;

  const percentage = Math.round((rated / total) * 100);
  const isComplete = rated === total;

  return (
    <div className="border border-border rounded-lg bg-card px-4 py-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] text-muted-foreground">
          {isComplete ? (
            <span className="text-green-400 font-medium">All rated! Nice taste.</span>
          ) : (
            <>
              <span className="font-mono font-semibold text-foreground">{rated}</span>
              <span className="text-subtle/70">/{total}</span>
              {" options rated"}
            </>
          )}
        </span>
        <span className="text-[10px] font-mono text-subtle/70">
          {percentage}%
        </span>
      </div>
      <div className="w-full h-[4px] bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${percentage}%`,
            background: isComplete
              ? "#22c55e"
              : "linear-gradient(90deg, #3b82f6, #8b5cf6)",
          }}
        />
      </div>
    </div>
  );
}
