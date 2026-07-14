"use client";

import Link from "next/link";
import { useMode } from "./ModeProvider";

/**
 * ArenaCta — Homepage call-to-action that only appears in Arena mode.
 * Hidden in Rating mode so the two modes stay cleanly separated.
 */
export function ArenaCta() {
  const { mode } = useMode();

  if (mode !== "arena") return null;

  return (
    <Link
      href="/"
      className="block border border-border/60 rounded-xl bg-card/60 p-4 hover:border-accent/60 hover:bg-accent/5 transition-all duration-200 group"
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl" aria-hidden="true">⚔️</span>
        <div>
          <h2 className="text-sm font-semibold text-foreground group-hover:text-accent-foreground transition-colors">
            Try Arena Mode
          </h2>
          <p className="text-xs text-muted-foreground">
            Pick a topic and vote head-to-head — which option is better?
          </p>
        </div>
      </div>
    </Link>
  );
}
