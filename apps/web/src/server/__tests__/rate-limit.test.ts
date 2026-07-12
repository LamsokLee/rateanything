/**
 * Unit tests for the rate-limit utility.
 * Uses vi.mock to mock the Redis client — no real Redis needed.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type Redis from "ioredis";

// Mock the redis module before importing rate-limit
vi.mock("../redis", () => ({
  getRedisClient: vi.fn(),
}));

// Mock trpc middleware to extract the checkRateLimit logic indirectly.
// Since checkRateLimit is not exported, we test via the exported `rateLimit` middleware.
vi.mock("../trpc", () => ({
  middleware: vi.fn((fn) => fn),
}));

import { getRedisClient } from "../redis";
import { rateLimit } from "../rate-limit";

const mockedGetRedisClient = vi.mocked(getRedisClient);

/** Minimal typed fake matching the Redis methods used by rate-limit */
interface FakeRedisClient extends Pick<Redis, "incr" | "expire"> {}

function createFakeRedis(incrFn: () => Promise<number>): FakeRedisClient {
  return {
    incr: vi.fn(incrFn) as unknown as Redis["incr"],
    expire: vi.fn(async () => 1) as unknown as Redis["expire"],
  };
}

describe("rate-limit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("enforcement — requests allowed up to limit, then blocked", () => {
    it("allows requests within the limit", async () => {
      let callCount = 0;
      const fakeRedis = createFakeRedis(async () => ++callCount);
      mockedGetRedisClient.mockReturnValue(fakeRedis as Redis);

      const middlewareFn = rateLimit("test.action", 3, 60);
      const nextFn = vi.fn(async () => ({ ok: true }));

      // Requests 1-3 should succeed
      for (let i = 0; i < 3; i++) {
        const ctx = { auth: { dbUserId: "user-123" }, req: undefined };
        await expect(
          (middlewareFn as Function)({ ctx, next: nextFn })
        ).resolves.toEqual({ ok: true });
      }
      expect(nextFn).toHaveBeenCalledTimes(3);
    });

    it("blocks requests exceeding the limit with TOO_MANY_REQUESTS", async () => {
      const fakeRedis = createFakeRedis(async () => 4); // Already over limit of 3
      mockedGetRedisClient.mockReturnValue(fakeRedis as Redis);

      const middlewareFn = rateLimit("test.action", 3, 60);
      const nextFn = vi.fn(async () => ({ ok: true }));
      const ctx = { auth: { dbUserId: "user-123" }, req: undefined };

      await expect(
        (middlewareFn as Function)({ ctx, next: nextFn })
      ).rejects.toMatchObject({
        code: "TOO_MANY_REQUESTS",
      });
      expect(nextFn).not.toHaveBeenCalled();
    });
  });

  describe("fail-open — allows requests when Redis is unavailable", () => {
    it("allows request when getRedisClient returns null", async () => {
      mockedGetRedisClient.mockReturnValue(null);

      const middlewareFn = rateLimit("test.action", 3, 60);
      const nextFn = vi.fn(async () => ({ ok: true }));
      const ctx = { auth: { dbUserId: "user-123" }, req: undefined };

      await expect(
        (middlewareFn as Function)({ ctx, next: nextFn })
      ).resolves.toEqual({ ok: true });
      expect(nextFn).toHaveBeenCalledTimes(1);
    });

    it("allows request when Redis throws an error", async () => {
      const fakeRedis = createFakeRedis(async () => {
        throw new Error("Connection refused");
      });
      mockedGetRedisClient.mockReturnValue(fakeRedis as Redis);

      const middlewareFn = rateLimit("test.action", 3, 60);
      const nextFn = vi.fn(async () => ({ ok: true }));
      const ctx = { auth: { dbUserId: "user-123" }, req: undefined };

      // Should NOT throw — fails open
      await expect(
        (middlewareFn as Function)({ ctx, next: nextFn })
      ).resolves.toEqual({ ok: true });
      expect(nextFn).toHaveBeenCalledTimes(1);
    });

    it("allows request when Redis times out", async () => {
      const fakeRedis: FakeRedisClient = {
        incr: vi.fn(() => new Promise<number>(() => {})) as unknown as Redis["incr"], // Never resolves
        expire: vi.fn(async () => 1) as unknown as Redis["expire"],
      };
      mockedGetRedisClient.mockReturnValue(fakeRedis as Redis);

      const middlewareFn = rateLimit("test.action", 3, 60);
      const nextFn = vi.fn(async () => ({ ok: true }));
      const ctx = { auth: { dbUserId: "user-123" }, req: undefined };

      // The 2000ms timeout in rate-limit.ts will trigger, then fail open
      await expect(
        (middlewareFn as Function)({ ctx, next: nextFn })
      ).resolves.toEqual({ ok: true });
      expect(nextFn).toHaveBeenCalledTimes(1);
    }, 5000);
  });

  describe("identifier extraction", () => {
    it("uses dbUserId when authenticated", async () => {
      const fakeRedis = createFakeRedis(async () => 1);
      mockedGetRedisClient.mockReturnValue(fakeRedis as Redis);

      const middlewareFn = rateLimit("test.action", 10, 60);
      const nextFn = vi.fn(async () => ({ ok: true }));
      const ctx = { auth: { dbUserId: "user-abc" }, req: undefined };

      await (middlewareFn as Function)({ ctx, next: nextFn });

      // The key passed to incr should contain the userId
      const incrKey = fakeRedis.incr.mock.calls[0]![0] as string;
      expect(incrKey).toContain("user-abc");
      expect(incrKey).toContain("test.action");
    });

    it("falls back to IP when not authenticated", async () => {
      const fakeRedis = createFakeRedis(async () => 1);
      mockedGetRedisClient.mockReturnValue(fakeRedis as Redis);

      const middlewareFn = rateLimit("test.action", 10, 60);
      const nextFn = vi.fn(async () => ({ ok: true }));
      const mockHeaders = {
        get: (key: string) => {
          if (key === "x-forwarded-for") return "1.2.3.4, 5.6.7.8";
          return null;
        },
      };
      const ctx = { auth: null, req: { headers: mockHeaders } };

      await (middlewareFn as Function)({ ctx, next: nextFn });

      const incrKey = fakeRedis.incr.mock.calls[0]![0] as string;
      expect(incrKey).toContain("1.2.3.4");
    });
  });
});
