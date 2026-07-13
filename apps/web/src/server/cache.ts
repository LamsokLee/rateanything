/**
 * Redis query cache layer — wraps expensive DB queries with TTL-based caching.
 *
 * Design:
 *   - Fails open: if Redis is unavailable, executes the query directly.
 *   - Cache keys: `cache:{router}.{procedure}:{argsHash}`
 *   - Invalidation: exact-match deletion on mutations.
 *
 * Production: set REDIS_URL to an Upstash or Redis Cloud endpoint.
 */
import { getRedisClient } from "./redis";

const DEFAULT_TTL = 60; // seconds

/**
 * Build a deterministic cache key from procedure name and input arguments.
 */
function buildKey(procedure: string, input: Record<string, unknown> | undefined): string {
  const args = input ? JSON.stringify(Object.entries(input).sort(([a], [b]) => a.localeCompare(b))) : "";
  return `cache:${procedure}:${args}`;
}

export interface CacheResult<T> {
  data: T;
  fromCache: boolean;
}

/**
 * Execute a query with caching.
 *
 * @param procedure — Dot-notation procedure name, e.g. "topics.trending"
 * @param input — Procedure input args (used for key uniqueness)
 * @param ttl — Cache TTL in seconds
 * @param fn — The actual DB query function
 */
export async function getCached<T>(
  procedure: string,
  input: Record<string, unknown> | undefined,
  ttl: number,
  fn: () => Promise<T>
): Promise<CacheResult<T>> {
  const redis = getRedisClient();

  if (!redis) {
    // No Redis — execute directly (fail open)
    const data = await fn();
    return { data, fromCache: false };
  }

  const key = buildKey(procedure, input);

  try {
    const cached = await redis.get(key);
    if (cached) {
      return { data: JSON.parse(cached) as T, fromCache: true };
    }
  } catch (err) {
    console.warn(`[cache] Redis GET error for ${key}:`, err);
    // Fall through to direct execution
  }

  // Cache miss — execute query
  const data = await fn();

  // Store in cache (fire-and-forget, non-blocking)
  try {
    const serialized = JSON.stringify(data);
    // Only cache if result is under 100KB (Redis limit sanity check)
    if (serialized.length < 100_000) {
      redis.setex(key, ttl, serialized).catch(() => {});
    }
  } catch (err) {
    console.warn(`[cache] Redis SET error for ${key}:`, err);
  }

  return { data, fromCache: false };
}

/**
 * Invalidate cache keys matching a pattern.
 *
 * @param pattern — Key pattern to match (e.g. "topics.trending:*" or "topics.getBySlug:*")
 */
export async function invalidateCache(pattern: string): Promise<number> {
  const redis = getRedisClient();
  if (!redis) return 0;

  try {
    // Use Redis SCAN to find matching keys, then delete them
    const keys: string[] = [];
    let cursor = "0";

    do {
      const [nextCursor, found] = await redis.scan(cursor, "MATCH", `cache:${pattern}`, "COUNT", 100);
      cursor = nextCursor;
      keys.push(...found);
    } while (cursor !== "0");

    if (keys.length > 0) {
      await redis.del(...keys);
    }

    return keys.length;
  } catch (err) {
    console.warn(`[cache] Invalidation error for pattern ${pattern}:`, err);
    return 0;
  }
}

/**
 * Invalidate exact cache key.
 */
export async function invalidateExact(procedure: string, input: Record<string, unknown> | undefined): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  const key = buildKey(procedure, input);
  try {
    await redis.del(key);
  } catch (err) {
    console.warn(`[cache] Invalidation error for ${key}:`, err);
  }
}
