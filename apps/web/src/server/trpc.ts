/**
 * tRPC initialization — AUTH ENABLED.
 * Protected procedures require Clerk authentication.
 */
import { initTRPC, TRPCError } from "@trpc/server";
import { db, users, eq } from "@rateanything/db";
import { clerkClient } from "@clerk/nextjs/server";
import superjson from "superjson";

export interface CreateContextOptions {
  req?: Request;
  clerkUserId?: string | null;
}

export interface AuthContext {
  db: typeof db;
  auth: { userId: string; dbUserId: string };
  req?: Request;
}

export interface UnauthContext {
  db: typeof db;
  auth: null;
  req?: Request;
}

export type AppContext = AuthContext | UnauthContext;

/**
 * Derive a URL-safe username from Clerk user data.
 * Fallback chain: username > email local part > "user_" + short ID.
 */
function deriveUsername(clerkUser: {
  username: string | null;
  emailAddresses: Array<{ emailAddress: string }>;
  id: string;
}): string {
  if (clerkUser.username) {
    return sanitizeUsername(clerkUser.username);
  }
  const email = clerkUser.emailAddresses[0]?.emailAddress;
  if (email) {
    return sanitizeUsername(email.split("@")[0]);
  }
  return `user_${clerkUser.id.slice(-8)}`;
}

/**
 * Sanitize a string into a valid username: lowercase, alphanumeric + underscores,
 * max 50 chars, no leading/trailing underscores.
 */
function sanitizeUsername(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 50) || "user";
}

/**
 * Ensure username is unique by appending a short suffix if needed.
 */
async function ensureUniqueUsername(desired: string, excludeClerkId?: string): Promise<string> {
  let candidate = desired;
  let attempts = 0;

  while (attempts < 5) {
    const [existing] = await db
      .select({ id: users.id, clerkId: users.clerkId })
      .from(users)
      .where(eq(users.username, candidate))
      .limit(1);

    if (!existing || (excludeClerkId && existing.clerkId === excludeClerkId)) {
      return candidate;
    }

    // Collision — append disambiguator
    const suffix = Math.random().toString(36).slice(2, 6);
    candidate = `${desired.slice(0, 44)}_${suffix}`;
    attempts++;
  }

  // Last resort: use clerkId suffix
  return `${desired.slice(0, 41)}_${excludeClerkId?.slice(-8) ?? "x"}`;
}

/**
 * Creates the tRPC context for each request.
 * Looks up the Clerk user in the local DB, lazily creating if not found.
 * Updates placeholder usernames on subsequent logins.
 */
export async function createTRPCContext(opts: CreateContextOptions = {}): Promise<AppContext> {
  const clerkUserId = opts.clerkUserId ?? null;

  if (!clerkUserId) {
    return { db, auth: null, req: opts.req };
  }

  // Look up user by Clerk ID — lazily create if not found
  const [user] = await db
    .select({ id: users.id, username: users.username, isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.clerkId, clerkUserId))
    .limit(1);

  if (user) {
    // If username is still a placeholder, update it from Clerk data
    if (user.username.startsWith("user_") && user.username.length <= 13) {
      try {
        const client = await clerkClient();
        const clerkUser = await client.users.getUser(clerkUserId);
        const derived = deriveUsername(clerkUser);
        // Only update if we got something better than the placeholder
        if (!derived.startsWith("user_")) {
          const uniqueUsername = await ensureUniqueUsername(derived, clerkUserId);
          await db
            .update(users)
            .set({ username: uniqueUsername, updatedAt: new Date() })
            .where(eq(users.id, user.id));
          // Return with updated context
          return { db, auth: { userId: clerkUserId, dbUserId: user.id }, req: opts.req };
        }
      } catch {
        // Non-fatal: keep placeholder if Clerk API fails
      }
    }
    return { db, auth: { userId: clerkUserId, dbUserId: user.id }, req: opts.req };
  }

  // User not in DB yet — fetch Clerk profile for meaningful username + email
  let username = `user_${clerkUserId.slice(-8)}`;
  let email = `${username}@example.com`;

  try {
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(clerkUserId);
    username = await ensureUniqueUsername(deriveUsername(clerkUser), clerkUserId);
    email = clerkUser.emailAddresses[0]?.emailAddress ?? email;
  } catch {
    // Non-fatal: proceed with placeholder if Clerk API is unreachable
  }

  const [newUser] = await db
    .insert(users)
    .values({
      clerkId: clerkUserId,
      email,
      username,
    })
    .returning({ id: users.id });

  return { db, auth: { userId: clerkUserId, dbUserId: newUser.id }, req: opts.req };
}

const t = initTRPC.context<AppContext>().create({
  transformer: superjson,
});

/** Public (unauthenticated) procedure */
export const publicProcedure = t.procedure;

/** Protected procedure — requires authenticated user */
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.auth) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Authentication required" });
  }
  return next({ ctx: ctx as AuthContext });
});

/** Admin-only procedure */
export const adminProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.auth) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Authentication required" });
  }

  const [user] = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, ctx.auth.dbUserId))
    .limit(1);

  if (!user?.isAdmin) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }

  return next({ ctx: ctx as AuthContext });
});

export const router = t.router;
export const middleware = t.middleware;
