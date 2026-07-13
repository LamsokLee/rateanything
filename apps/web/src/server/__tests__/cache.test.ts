/**
 * Unit tests for server/cache.ts — Redis-backed query caching.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("getCached", () => {
  beforeEach(() => {
    vi.resetModules();
    const g = globalThis as unknown as { __redisClient?: unknown; __redisInitialized?: boolean };
    delete g.__redisClient;
    delete g.__redisInitialized;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("executes query directly when Redis is not configured", async () => {
    vi.stubEnv("REDIS_URL", "");

    const { getCached } = await import("@/server/cache");
    const fn = vi.fn().mockResolvedValue({ data: "test" });

    const result = await getCached("test.procedure", { id: 1 }, 60, fn);

    expect(result.data).toEqual({ data: "test" });
    expect(result.fromCache).toBe(false);
    expect(fn).toHaveBeenCalledOnce();
  });

  it("returns cached data on cache hit", async () => {
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");

    const mockGet = vi.fn().mockResolvedValue(JSON.stringify({ cached: true }));
    const mockSetex = vi.fn().mockResolvedValue("OK");
    const mockOn = vi.fn().mockReturnThis();

    const MockRedis = vi.fn().mockImplementation(() => ({
      get: mockGet,
      setex: mockSetex,
      on: mockOn,
    }));

    vi.doMock("ioredis", () => ({
      default: MockRedis,
    }));

    const { getCached } = await import("@/server/cache");
    const fn = vi.fn().mockResolvedValue({ fresh: true });

    const result = await getCached("test.procedure", { id: 1 }, 60, fn);

    expect(result.data).toEqual({ cached: true });
    expect(result.fromCache).toBe(true);
    expect(fn).not.toHaveBeenCalled();
  });

  it("caches data on cache miss and stores in Redis", async () => {
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");

    const mockGet = vi.fn().mockResolvedValue(null);
    const mockSetex = vi.fn().mockResolvedValue("OK");
    const mockOn = vi.fn().mockReturnThis();

    const MockRedis = vi.fn().mockImplementation(() => ({
      get: mockGet,
      setex: mockSetex,
      on: mockOn,
    }));

    vi.doMock("ioredis", () => ({
      default: MockRedis,
    }));

    const { getCached } = await import("@/server/cache");
    const fn = vi.fn().mockResolvedValue({ fresh: true });

    const result = await getCached("test.procedure", { id: 1 }, 60, fn);

    expect(result.data).toEqual({ fresh: true });
    expect(result.fromCache).toBe(false);
    expect(fn).toHaveBeenCalledOnce();
    expect(mockSetex).toHaveBeenCalledOnce();
  });

  it("executes query on Redis GET error (fail open)", async () => {
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");

    const mockGet = vi.fn().mockRejectedValue(new Error("Redis down"));
    const mockOn = vi.fn().mockReturnThis();

    const MockRedis = vi.fn().mockImplementation(() => ({
      get: mockGet,
      on: mockOn,
    }));

    vi.doMock("ioredis", () => ({
      default: MockRedis,
    }));

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { getCached } = await import("@/server/cache");
    const fn = vi.fn().mockResolvedValue({ fallback: true });

    const result = await getCached("test.procedure", { id: 1 }, 60, fn);

    expect(result.data).toEqual({ fallback: true });
    expect(result.fromCache).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Redis GET error"),
      expect.any(Error)
    );

    warnSpy.mockRestore();
  });

  it("does not cache results larger than 100KB", async () => {
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");

    const mockGet = vi.fn().mockResolvedValue(null);
    const mockSetex = vi.fn().mockResolvedValue("OK");
    const mockOn = vi.fn().mockReturnThis();

    const MockRedis = vi.fn().mockImplementation(() => ({
      get: mockGet,
      setex: mockSetex,
      on: mockOn,
    }));

    vi.doMock("ioredis", () => ({
      default: MockRedis,
    }));

    const { getCached } = await import("@/server/cache");
    const largeData = { data: "x".repeat(200_000) };
    const fn = vi.fn().mockResolvedValue(largeData);

    await getCached("test.procedure", {}, 60, fn);

    expect(mockSetex).not.toHaveBeenCalled();
  });
});

describe("invalidateCache", () => {
  beforeEach(() => {
    vi.resetModules();
    const g = globalThis as unknown as { __redisClient?: unknown; __redisInitialized?: boolean };
    delete g.__redisClient;
    delete g.__redisInitialized;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns 0 when Redis is not configured", async () => {
    vi.stubEnv("REDIS_URL", "");

    const { invalidateCache } = await import("@/server/cache");
    const count = await invalidateCache("topics.*");
    expect(count).toBe(0);
  });

  it("deletes matching keys using SCAN + DEL", async () => {
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");

    const mockScan = vi.fn()
      .mockResolvedValueOnce(["0", ["cache:topics.trending:1", "cache:topics.trending:2"]]);
    const mockDel = vi.fn().mockResolvedValue(2);
    const mockOn = vi.fn().mockReturnThis();

    const MockRedis = vi.fn().mockImplementation(() => ({
      scan: mockScan,
      del: mockDel,
      on: mockOn,
    }));

    vi.doMock("ioredis", () => ({
      default: MockRedis,
    }));

    const { invalidateCache } = await import("@/server/cache");
    const count = await invalidateCache("topics.trending:*");

    expect(count).toBe(2);
    expect(mockDel).toHaveBeenCalledWith("cache:topics.trending:1", "cache:topics.trending:2");
  });

  it("handles scan pagination", async () => {
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");

    const mockScan = vi.fn()
      .mockResolvedValueOnce(["1", ["cache:topics.trending:1"]])
      .mockResolvedValueOnce(["0", ["cache:topics.trending:2"]]);
    const mockDel = vi.fn().mockResolvedValue(2);
    const mockOn = vi.fn().mockReturnThis();

    const MockRedis = vi.fn().mockImplementation(() => ({
      scan: mockScan,
      del: mockDel,
      on: mockOn,
    }));

    vi.doMock("ioredis", () => ({
      default: MockRedis,
    }));

    const { invalidateCache } = await import("@/server/cache");
    const count = await invalidateCache("topics.trending:*");

    expect(count).toBe(2);
    expect(mockScan).toHaveBeenCalledTimes(2);
    expect(mockDel).toHaveBeenCalledWith("cache:topics.trending:1", "cache:topics.trending:2");
  });

  it("returns 0 and logs warning on Redis error", async () => {
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");

    const mockScan = vi.fn().mockRejectedValue(new Error("Redis down"));
    const mockOn = vi.fn().mockReturnThis();

    const MockRedis = vi.fn().mockImplementation(() => ({
      scan: mockScan,
      on: mockOn,
    }));

    vi.doMock("ioredis", () => ({
      default: MockRedis,
    }));

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { invalidateCache } = await import("@/server/cache");
    const count = await invalidateCache("topics.*");

    expect(count).toBe(0);
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});

describe("invalidateExact", () => {
  beforeEach(() => {
    vi.resetModules();
    const g = globalThis as unknown as { __redisClient?: unknown; __redisInitialized?: boolean };
    delete g.__redisClient;
    delete g.__redisInitialized;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("deletes exact key from Redis", async () => {
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");

    const mockDel = vi.fn().mockResolvedValue(1);
    const mockOn = vi.fn().mockReturnThis();

    const MockRedis = vi.fn().mockImplementation(() => ({
      del: mockDel,
      on: mockOn,
    }));

    vi.doMock("ioredis", () => ({
      default: MockRedis,
    }));

    const { invalidateExact } = await import("@/server/cache");
    await invalidateExact("topics.getBySlug", { slug: "test" });

    expect(mockDel).toHaveBeenCalledOnce();
  });

  it("returns gracefully when Redis is not configured", async () => {
    vi.stubEnv("REDIS_URL", "");

    const { invalidateExact } = await import("@/server/cache");
    await expect(invalidateExact("test", {})).resolves.toBeUndefined();
  });
});
