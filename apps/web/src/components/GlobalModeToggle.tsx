"use client";

/**
 * GlobalModeToggle — Site-wide switch between Arena and Ratings modes.
 * Compact version for the navbar: icon-only on small screens, with labels on md+.
 */
import { useMode } from "./ModeProvider";

export function GlobalModeToggle() {
  const { mode, setMode } = useMode();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      setMode(mode === "arena" ? "rate" : "arena");
    }
  };

  return (
    <div
      role="tablist"
      aria-label="Global mode"
      className="flex items-center gap-1 rounded-lg bg-muted/80 p-1 border border-input/50"
      onKeyDown={handleKeyDown}
    >
      <button
        role="tab"
        id="global-tab-arena"
        aria-selected={mode === "arena"}
        aria-controls="global-panel-arena"
        tabIndex={mode === "arena" ? 0 : -1}
        onClick={() => setMode("arena")}
        className={`px-2 md:px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-150 ${
          mode === "arena"
            ? "bg-accent text-accent-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground hover:bg-muted"
        }`}
        title="Arena mode"
        aria-label="Arena mode"
      >
        <span aria-hidden="true">⚔️</span>
        <span className="hidden md:inline ml-1.5">Arena</span>
      </button>
      <button
        role="tab"
        id="global-tab-rate"
        aria-selected={mode === "rate"}
        aria-controls="global-panel-rate"
        tabIndex={mode === "rate" ? 0 : -1}
        onClick={() => setMode("rate")}
        className={`px-2 md:px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-150 ${
          mode === "rate"
            ? "bg-accent text-accent-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground hover:bg-muted"
        }`}
        title="Rating mode"
        aria-label="Rating mode"
      >
        <span aria-hidden="true">📊</span>
        <span className="hidden md:inline ml-1.5">Rate</span>
      </button>
    </div>
  );
}
