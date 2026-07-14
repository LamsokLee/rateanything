"use client";

import { useState, useCallback } from "react";

interface ShareButtonProps {
  /** Title to share (used in native share dialog) */
  title: string;
  /** URL to share — defaults to current page URL */
  url?: string;
}

/**
 * Share button — uses native Web Share API on supported devices,
 * falls back to clipboard copy with brief "Link copied!" feedback.
 * Includes legacy execCommand fallback for non-secure contexts (HTTP).
 */
export function ShareButton({ title, url }: ShareButtonProps) {
  const [feedback, setFeedback] = useState<string | null>(null);

  /** Legacy clipboard fallback using a temporary textarea + execCommand. */
  function legacyCopy(text: string): boolean {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    // Prevent scrolling to bottom on iOS
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "-9999px";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    let success = false;
    try {
      success = document.execCommand("copy");
    } catch {
      success = false;
    }
    document.body.removeChild(textarea);
    return success;
  }

  const handleShare = useCallback(async () => {
    const shareUrl = url ?? window.location.href;

    // Use native share if available (mobile browsers)
    if (navigator.share) {
      try {
        await navigator.share({ title, url: shareUrl });
      } catch {
        // User cancelled or share failed — ignore
      }
      return;
    }

    // Fallback: copy to clipboard
    // Try modern Clipboard API first, then legacy execCommand for HTTP contexts
    let success = false;
    try {
      await navigator.clipboard.writeText(shareUrl);
      success = true;
    } catch {
      // Clipboard API failed (non-secure context) — use legacy fallback
      success = legacyCopy(shareUrl);
    }

    if (success) {
      setFeedback("Link copied!");
    } else {
      setFeedback("Copy failed");
    }
    setTimeout(() => setFeedback(null), 2000);
  }, [title, url]);

  return (
    <button
      onClick={handleShare}
      aria-label="Share this topic"
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-subtle hover:text-foreground border border-border/60 rounded-lg bg-transparent hover:bg-muted/30 transition-colors duration-150"
    >
      {/* Share icon — arrow-up-from-square */}
      <svg
        className="w-3.5 h-3.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 8.25H7.5a2.25 2.25 0 0 0-2.25 2.25v9a2.25 2.25 0 0 0 2.25 2.25h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25H15m0-3-3-3m0 0-3 3m3-3v9"
        />
      </svg>
      {feedback ?? "Share"}
    </button>
  );
}
