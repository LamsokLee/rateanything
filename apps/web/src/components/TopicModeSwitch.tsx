"use client";

/**
 * TopicModeSwitch — Accessible tab-style toggle between Arena and Ratings modes.
 * Arena is visually primary (default); Ratings remains reachable.
 * Uses tablist/tab ARIA pattern for keyboard navigation.
 */

export type TopicMode = "arena" | "ratings";

interface TopicModeSwitchProps {
  mode: TopicMode;
  onModeChange: (mode: TopicMode) => void;
}

export function TopicModeSwitch({ mode, onModeChange }: TopicModeSwitchProps) {
  /** Handle keyboard nav within tablist: ArrowLeft/ArrowRight between tabs */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const next: TopicMode = mode === "arena" ? "ratings" : "arena";
      onModeChange(next);
    }
  };

  return (
    <div
      role="tablist"
      aria-label="Topic interaction mode"
      className="flex items-center gap-1 rounded-lg bg-muted/80 p-1 border border-input/50 w-fit"
      onKeyDown={handleKeyDown}
    >
      <button
        role="tab"
        id="tab-arena"
        aria-selected={mode === "arena"}
        aria-controls="panel-arena"
        tabIndex={mode === "arena" ? 0 : -1}
        onClick={() => onModeChange("arena")}
        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-150 ${
          mode === "arena"
            ? "bg-accent text-accent-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground hover:bg-muted"
        }`}
      >
        ⚔️ Arena
      </button>
      <button
        role="tab"
        id="tab-ratings"
        aria-selected={mode === "ratings"}
        aria-controls="panel-ratings"
        tabIndex={mode === "ratings" ? 0 : -1}
        onClick={() => onModeChange("ratings")}
        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-150 ${
          mode === "ratings"
            ? "bg-accent text-accent-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground hover:bg-muted"
        }`}
      >
        📊 Ratings
      </button>
    </div>
  );
}
