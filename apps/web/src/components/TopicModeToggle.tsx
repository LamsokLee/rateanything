"use client";

/**
 * TopicModeToggle — Tab bar switching between Arena and Rate 1-10 modes.
 * Uses URL search params (?mode=arena or ?mode=rate) for state.
 * Default mode is 'arena' (Arena-first requirement).
 * Supports ArrowLeft/ArrowRight/ArrowUp/ArrowDown keyboard navigation
 * per the ARIA tablist pattern.
 */
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useRef } from "react";

interface TopicModeToggleProps {
  mode: "arena" | "rate";
}

const tabs = [
  { key: "arena" as const, label: "⚔️ Arena", panelId: "panel-arena" },
  { key: "rate" as const, label: "📊 Rate 1-10", panelId: "panel-ratings" },
];

export function TopicModeToggle({ mode }: TopicModeToggleProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleSwitch = useCallback(
    (newMode: "arena" | "rate") => {
      const params = new URLSearchParams(searchParams.toString());
      if (newMode === "arena") {
        // Remove mode param for default (arena) to keep URLs clean
        params.delete("mode");
      } else {
        params.set("mode", newMode);
      }
      const qs = params.toString();
      router.push(qs ? `?${qs}` : "?", { scroll: false });
    },
    [router, searchParams]
  );

  /** ARIA tablist keyboard navigation: ArrowLeft/ArrowRight between tabs */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, currentIndex: number) => {
      let nextIndex: number | null = null;

      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        nextIndex = (currentIndex + 1) % tabs.length;
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      }

      if (nextIndex !== null) {
        tabRefs.current[nextIndex]?.focus();
        handleSwitch(tabs[nextIndex].key);
      }
    },
    [handleSwitch]
  );

  return (
    <div
      role="tablist"
      aria-label="Topic interaction mode"
      className="inline-flex items-center gap-1 rounded-lg bg-muted/80 p-1 border border-input/50 w-fit"
    >
      {tabs.map((tab, index) => {
        const isActive = mode === tab.key;
        return (
          <button
            key={tab.key}
            ref={(el) => { tabRefs.current[index] = el; }}
            role="tab"
            id={`tab-${tab.key}`}
            aria-selected={isActive}
            aria-controls={tab.panelId}
            tabIndex={isActive ? 0 : -1}
            onClick={() => handleSwitch(tab.key)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-150 ${
              isActive
                ? "bg-accent text-accent-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
