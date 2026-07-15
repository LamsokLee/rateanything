"use client";

/**
 * MobileNavSearch — A magnifier icon button visible only on mobile (<sm).
 * Toggles a full-width search row below the nav bar.
 * On >=sm the inline NavSearch is used instead (see layout.tsx).
 *
 * Accessibility:
 * - aria-label dynamically reflects state ('Open search' / 'Close search')
 * - aria-expanded reflects open/closed state
 * - aria-controls references the panel id for proper disclosure semantics
 * - Focus moves to input when expanded
 * - Keyboard operable (Enter/Space native on <button>)
 * - Escape key closes the panel
 * - Click-outside closes the panel
 * - Panel auto-closes on route change (after search submission/navigation)
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { NavSearch } from "./NavSearch";

const PANEL_ID = "mobile-nav-search-panel";

export function MobileNavSearch() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  // Auto-close panel when the route changes (e.g. after search submission)
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Move focus to the search input when the panel opens
  useEffect(() => {
    if (open && panelRef.current) {
      const input = panelRef.current.querySelector("input");
      input?.focus();
    }
  }, [open]);

  // Close on Escape key and click-outside (only while open)
  const handleClose = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
        buttonRef.current?.focus();
      }
    };

    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        handleClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [open, handleClose]);

  return (
    <>
      {/* Magnifier icon button — visible only below sm breakpoint */}
      <button
        ref={buttonRef}
        type="button"
        aria-label={open ? "Close search" : "Open search"}
        aria-expanded={open}
        aria-controls={PANEL_ID}
        onClick={() => setOpen((prev) => !prev)}
        className="sm:hidden inline-flex items-center justify-center w-9 h-9 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </button>

      {/* Expandable search row — full-width below the nav, mobile only */}
      {open && (
        <div
          id={PANEL_ID}
          ref={panelRef}
          className="sm:hidden absolute left-0 top-full w-full border-b border-border bg-background/95 backdrop-blur-sm px-4 py-2"
        >
          <NavSearch />
        </div>
      )}
    </>
  );
}
