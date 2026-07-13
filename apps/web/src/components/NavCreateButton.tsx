"use client";

import Link from "next/link";
import { useAuth } from "./AuthProvider";

/**
 * NavCreateButton — renders the "+ Create Topic" link only when the user is signed in.
 * In guest/placeholder mode, useAuth reports isSignedIn=false so this renders nothing.
 */
export function NavCreateButton() {
  const { isSignedIn, isLoading } = useAuth();

  if (isLoading || !isSignedIn) {
    return null;
  }

  return (
    <Link
      href="/create"
      className="inline-flex items-center rounded-lg bg-accent px-3 py-1.5 text-[11px] font-semibold text-accent-foreground hover:bg-accent/80 transition-colors"
    >
      <span className="hidden sm:inline">+ Create Topic</span>
      <span className="sm:hidden">+</span>
    </Link>
  );
}
