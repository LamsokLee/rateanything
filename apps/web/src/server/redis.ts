/**
 * Shared Redis client for the web app.
 * Used for rate limiting (and future caching needs).
 * Reuses ioredis which is already installed (dependency of bullmq).
 *
 * IMPORTANT: If REDIS_URL is not set or Redis is unavailable,
 * consumers MUST fail open (allow requests). This client may be null.
 *
 * Production caveat: REDIS_URL is currently empty in prod.
 * Until a Redis instance is provisioned for production, all rate
 * limiting will fail open (requests allowed, warning logged).
 */
import Redis from "ioredis";

// Use globalThis to persist the client across Next.js dev mode hot-reloads
const globalForRedis = globalThis as unknown as { __redisClient?: Redis | null; __redisInitialized?: boolean };

function createRedisClient(): Redis | null {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    console.warn("[rate-limit] REDIS_URL not set — rate limiting will fail open (all requests allowed)");
    return null;
  }

  try {
    const client = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
      // Allow commands to queue briefly during initial connection
      enableOfflineQueue: true,
      // Reconnect with short backoff — don't hold requests for too long
      retryStrategy: (times: number) => {
        if (times > 3) return null; // Stop reconnecting after 3 attempts
        return Math.min(times * 200, 1000);
      },
    });

    client.on("error", (err) => {
      console.warn("[rate-limit] Redis connection error (fail-open mode):", err.message);
    });

    return client;
  } catch (err) {
    console.warn("[rate-limit] Failed to create Redis client:", err);
    return null;
  }
}

/** Lazy-initialized Redis client singleton. May be null if REDIS_URL is not configured. */
export function getRedisClient(): Redis | null {
  if (!globalForRedis.__redisInitialized) {
    globalForRedis.__redisClient = createRedisClient();
    globalForRedis.__redisInitialized = true;
  }
  return globalForRedis.__redisClient ?? null;
}
