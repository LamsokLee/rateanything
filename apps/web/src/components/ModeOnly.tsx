"use client";

import type { AppMode } from "./ModeProvider";
import { useMode } from "./ModeProvider";

interface ModeOnlyProps {
  mode: AppMode;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * ModeOnly — Renders children only when the global mode matches the given mode.
 * Useful inside server components to conditionally show mode-specific UI.
 */
export function ModeOnly({ mode, children, fallback }: ModeOnlyProps) {
  const { mode: currentMode } = useMode();

  if (currentMode !== mode) {
    return fallback ?? null;
  }

  return <>{children}</>;
}
