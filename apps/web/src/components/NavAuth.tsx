"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "./AuthProvider";
import { SignInButton, UserButton, useUser } from "@clerk/nextjs";

/**
 * Detect dev-mode bypass: if NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY contains
 * "placeholder", Clerk is not initialized and we must not call its hooks/components.
 */
function isDevBypass(): boolean {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
  return !key || key.includes("placeholder");
}

/** NavAuth with Clerk components — only when Clerk is active */
function NavAuthWithClerk() {
  const { user, isLoading } = useAuth();
  const clerkUser = useUser();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent hydration mismatch: render nothing until client mount
  if (!mounted) {
    return <div className="w-16 h-8" />;
  }

  if (isLoading || !clerkUser.isLoaded) {
    return (
      <span className="text-xs text-subtle animate-pulse">Loading...</span>
    );
  }

  if (user) {
    // Profile link: use /me which server-side redirects to /user/{dbUsername}
    const profileHref = "/me" as const;

    return (
      <div className="flex items-center gap-2 sm:gap-3">
        <Link
          href={profileHref}
          className="text-sm text-foreground/80 hover:text-foreground transition-colors truncate max-w-[120px] sm:max-w-none"
          aria-label={`View profile for ${user.displayName}`}
        >
          @{user.displayName}
        </Link>
        <UserButton
          afterSignOutUrl="/"
          appearance={{
            elements: {
              userButtonAvatarBox: "w-7 h-7 sm:w-8 sm:h-8",
              userButtonTrigger: "text-muted-foreground hover:text-foreground",
            },
          }}
        >
          <UserButton.MenuItems>
            <UserButton.Link
              label="My Profile"
              labelIcon={<ProfileIcon />}
              href={profileHref}
            />
          </UserButton.MenuItems>
        </UserButton>
      </div>
    );
  }

  return (
    <SignInButton mode="modal">
      <button className="rounded bg-accent px-3 py-1.5 text-[11px] font-semibold text-accent-foreground hover:bg-accent transition-colors">
        Log In
      </button>
    </SignInButton>
  );
}

/** Simple user profile icon for the menu item */
function ProfileIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      width={16}
      height={16}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
      />
    </svg>
  );
}

/** Guest-only NavAuth for dev-mode bypass */
function NavAuthGuest() {
  return (
    <span className="text-xs text-subtle">Guest Mode</span>
  );
}

export function NavAuth() {
  if (isDevBypass()) {
    return <NavAuthGuest />;
  }
  return <NavAuthWithClerk />;
}
