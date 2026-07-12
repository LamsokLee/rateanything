"use client";

/**
 * AuthProvider — Wrapper around Clerk's SignedIn/SignedOut components.
 * Provides a consistent useAuth hook for the rest of the app.
 * Falls back to guest fingerprint for unauthenticated users.
 * Dev-mode bypass: skips Clerk hooks when publishable key is placeholder.
 *
 * Display name fallback chain (robust for Google/email signups):
 *   Clerk username > fullName > firstName > email local part > "User"
 */
import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { useUser as useClerkUser } from "@clerk/nextjs";

interface AuthUser {
  id: string;
  /** Robust display name — never null for signed-in users */
  displayName: string;
  /** Clerk username field (may be null for Google/email signups) */
  username: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isSignedIn: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  isSignedIn: false,
});

/**
 * Detect dev-mode bypass: if NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY contains
 * "placeholder", Clerk is not initialized and we must not call its hooks.
 */
function isDevBypass(): boolean {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
  return !key || key.includes("placeholder");
}

/**
 * Derive a robust display name from Clerk user fields.
 * Fallback chain: username > fullName > firstName > email local part > "User"
 */
function deriveDisplayName(clerkUser: {
  username: string | null;
  fullName: string | null;
  firstName: string | null;
  primaryEmailAddress?: { emailAddress: string } | null;
}): string {
  if (clerkUser.username) return clerkUser.username;
  if (clerkUser.fullName) return clerkUser.fullName;
  if (clerkUser.firstName) return clerkUser.firstName;
  const email = clerkUser.primaryEmailAddress?.emailAddress;
  if (email) return email.split("@")[0];
  return "User";
}

/** Inner provider that uses Clerk hooks — only rendered when Clerk is active */
function ClerkAuthProvider({ children }: { children: ReactNode }) {
  const clerkUser = useClerkUser();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (clerkUser.isLoaded) {
      if (clerkUser.isSignedIn && clerkUser.user) {
        setUser({
          id: clerkUser.user.id,
          displayName: deriveDisplayName(clerkUser.user),
          username: clerkUser.user.username,
        });
      } else {
        setUser(null);
      }
      setIsLoading(false);
    }
  }, [clerkUser.isLoaded, clerkUser.isSignedIn, clerkUser.user]);

  return (
    <AuthContext.Provider
      value={{ user, isLoading, isSignedIn: clerkUser.isSignedIn ?? false }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/** Guest-only provider for dev-mode bypass */
function GuestAuthProvider({ children }: { children: ReactNode }) {
  return (
    <AuthContext.Provider value={{ user: null, isLoading: false, isSignedIn: false }}>
      {children}
    </AuthContext.Provider>
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  if (isDevBypass()) {
    return <GuestAuthProvider>{children}</GuestAuthProvider>;
  }
  return <ClerkAuthProvider>{children}</ClerkAuthProvider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

/** Generate a simple browser fingerprint for guest ratings */
export function getFingerprint(): string {
  if (typeof window === "undefined") return "server";
  const nav = window.navigator;
  const raw = [
    nav.userAgent,
    nav.language,
    new Date().getTimezoneOffset().toString(),
    screen.width.toString(),
    screen.height.toString(),
  ].join("|");
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
