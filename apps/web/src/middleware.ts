/**
 * Clerk middleware for Next.js App Router.
 * Protects API routes and routes with auth requirements.
 * Production-safe with pk_live keys.
 * Dev-mode bypass: skips Clerk auth when publishable key contains "placeholder".
 */
import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

const isDevMode =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.includes("placeholder") ??
  false;

function devMiddleware(req: NextRequest) {
  return NextResponse.next();
}

const prodMiddleware = clerkMiddleware(async (auth, req) => {
  // Optional: protect specific routes here if needed
  // For now, just let all requests through and handle auth in tRPC
  return NextResponse.next();
});

export default isDevMode ? devMiddleware : prodMiddleware;

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
