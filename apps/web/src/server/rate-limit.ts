/**
 * Rate limiting utility — Redis-backed fixed-window counter.
 * Keys: ratelimit:{action}:{identifier}:{windowStart}
 * Identifier: userId (if authed) or clientIp.
 *
 * FAIL-OPEN: On ANY Redis error or unavailability, the request is ALLOWED
 * and a warning is logged. This ensures the app never crashes due to Redis
 * being down (critical for Vercel serverless where prod Redis may not yet
 * be provisioned).
 *
 * Uses atomic INCR + EXPIRE for fixed-window counting.
 */
import { TRPCError } from "@trpc/server";
import { middleware } from "./trpc";
import { getRedisClient } from "./redis";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number; // Unix timestamp (seconds)
}

/**
 * Check rate limit for a given action and identifier using Redis fixed-window.
 * Returns { allowed, remaining, resetAt }.
 * On Redis error: returns allowed=true (fail open).
 */
async function checkRateLimit(
  action: string,
  identifier: string,
  limit: number,
  windowSec: number
): Promise<RateLimitResult> {
  const redis = getRedisClient();

  if (!redis) {
    // No Redis available — fail open
    return { allowed: true, remaining: limit, resetAt: 0 };
  }

  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % windowSec);
  const windowKey = `ratelimit:${action}:${identifier}:${windowStart}`;
  const resetAt = windowStart + windowSec;

  try {
    // Atomic INCR + conditional EXPIRE with a timeout to avoid blocking
    const count = await Promise.race([
      redis.incr(windowKey),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Redis timeout")), 2000)
      ),
    ]);

    if (count === 1) {
      // First request in this window — set TTL (fire-and-forget, non-blocking)
      redis.expire(windowKey, windowSec).catch(() => {});
    }

    const allowed = count <= limit;
    const remaining = Math.max(0, limit - count);

    return { allowed, remaining, resetAt };
  } catch (err) {
    // Redis error — fail open, log warning
    console.warn(`[rate-limit] Redis error for ${action}:${identifier} — failing open:`, err);
    return { allowed: true, remaining: limit, resetAt: 0 };
  }
}

/**
 * Extract client IP from request headers.
 * Checks x-forwarded-for, x-real-ip, then falls back to "127.0.0.1".
 */
function getClientIp(req: Request | undefined): string {
  if (!req) return "unknown";
  // Trust model: On Vercel, the platform overwrites x-forwarded-for with the
  // true client IP so it cannot be spoofed. Behind an untrusted proxy, the
  // first entry could be attacker-controlled — validate proxy trust before relying on this.
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "127.0.0.1";
}

/**
 * tRPC middleware factory for rate limiting.
 * Usage: .use(rateLimit("ratings.submit", 30, 3600))
 *
 * @param action - Unique action name for the rate limit bucket
 * @param limit - Max requests allowed in the window
 * @param windowSec - Window duration in seconds
 */
export function rateLimit(action: string, limit: number, windowSec: number) {
  return middleware(async ({ ctx, next }) => {
    // Determine identifier: userId if authenticated, else client IP
    const identifier = ctx.auth?.dbUserId ?? getClientIp(ctx.req);

    const result = await checkRateLimit(action, identifier, limit, windowSec);

    if (!result.allowed) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `Rate limit exceeded for ${action}. Please try again later.`,
      });
    }

    return next();
  });
}
