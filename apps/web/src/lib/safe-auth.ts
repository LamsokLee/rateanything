/**
 * safe-auth — Dev-mode-aware wrapper around Clerk's auth().
 * In dev bypass mode (placeholder key), returns { userId: null } instead of throwing.
 */
import { auth as clerkAuth } from "@clerk/nextjs/server";

const isDevBypass =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.includes("placeholder") ?? false;

export async function safeAuth(): Promise<{ userId: string | null }> {
  if (isDevBypass) {
    return { userId: null };
  }
  return clerkAuth();
}
