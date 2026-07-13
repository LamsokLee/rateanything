/**
 * Unit tests for server/redis.ts — getRedisClient singleton factory.
 * Mocks ioredis to test both URL-set and URL-missing branches.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("getRedisClient", () => {
  beforeEach(() => {
    vi.resetModules();
    // Clear global singleton state between tests
    const g = globalThis as unknown as { __redisClient?: unknown; __redisInitialized?: boolean };
    delete g.__redisClient;
    delete g.__redisInitialized;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns null when REDIS_URL is not set", async () => {
    vi.stubEnv("REDIS_URL", "");

    const { getRedisClient } = await import("@/server/redis");
    const client = getRedisClient();
    expect(client).toBeNull();
  });

  it("creates a Redis client when REDIS_URL is set", async () => {
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");

    // Mock ioredis to avoid real connection
    const mockOn = vi.fn().mockReturnThis();
    const MockRedis = vi.fn().mockImplementation(() => ({
      on: mockOn,
      disconnect: vi.fn(),
    }));

    vi.doMock("ioredis", () => ({
      default: MockRedis,
    }));

    const { getRedisClient } = await import("@/server/redis");
    const client = getRedisClient();
    expect(client).not.toBeNull();
    expect(MockRedis).toHaveBeenCalledOnce();
    expect(mockOn).toHaveBeenCalledWith("error", expect.any(Function));
  });

  it("returns same instance on second call (singleton)", async () => {
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");

    const mockOn = vi.fn().mockReturnThis();
    const MockRedis = vi.fn().mockImplementation(() => ({
      on: mockOn,
      disconnect: vi.fn(),
    }));

    vi.doMock("ioredis", () => ({
      default: MockRedis,
    }));

    const { getRedisClient } = await import("@/server/redis");
    const first = getRedisClient();
    const second = getRedisClient();
    expect(first).toBe(second);
    expect(MockRedis).toHaveBeenCalledOnce();
  });

  it("returns null and logs warning when Redis constructor throws", async () => {
    vi.stubEnv("REDIS_URL", "redis://bad-host:9999");

    const MockRedis = vi.fn().mockImplementation(() => {
      throw new Error("Connection failed");
    });

    vi.doMock("ioredis", () => ({
      default: MockRedis,
    }));

    const { getRedisClient } = await import("@/server/redis");
    const client = getRedisClient();
    expect(client).toBeNull();
  });

  it("error handler logs but does not throw", async () => {
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");

    let errorHandler: ((err: Error) => void) | undefined;
    const mockOn = vi.fn().mockImplementation((event: string, handler: (err: Error) => void) => {
      if (event === "error") errorHandler = handler;
      return {};
    });
    const MockRedis = vi.fn().mockImplementation(() => ({
      on: mockOn,
    }));

    vi.doMock("ioredis", () => ({
      default: MockRedis,
    }));

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { getRedisClient } = await import("@/server/redis");
    getRedisClient();

    // Trigger the error handler
    expect(errorHandler).toBeDefined();
    errorHandler!(new Error("connection reset"));
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Redis connection error"),
      "connection reset"
    );

    warnSpy.mockRestore();
  });
});

describe("getRedisClient retryStrategy", () => {
  beforeEach(() => {
    vi.resetModules();
    const g = globalThis as unknown as { __redisClient?: unknown; __redisInitialized?: boolean };
    delete g.__redisClient;
    delete g.__redisInitialized;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("retryStrategy returns increasing delays up to 3 attempts, then null", async () => {
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");

    let capturedOptions: Record<string, unknown> | undefined;
    const mockOn = vi.fn().mockReturnThis();
    const MockRedis = vi.fn().mockImplementation((_url: string, opts: Record<string, unknown>) => {
      capturedOptions = opts;
      return { on: mockOn };
    });

    vi.doMock("ioredis", () => ({
      default: MockRedis,
    }));

    const { getRedisClient } = await import("@/server/redis");
    getRedisClient();

    expect(capturedOptions).toBeDefined();
    const retryStrategy = capturedOptions!.retryStrategy as (times: number) => number | null;

    // First 3 attempts: return delay
    expect(retryStrategy(1)).toBe(200);
    expect(retryStrategy(2)).toBe(400);
    expect(retryStrategy(3)).toBe(600);
    // After 3 attempts: returns null
    expect(retryStrategy(4)).toBeNull();
  });
});
