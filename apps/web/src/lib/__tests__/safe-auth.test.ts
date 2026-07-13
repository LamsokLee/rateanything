/**
 * Unit tests for lib/safe-auth.
 * Tests: dev bypass behavior when NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY contains "placeholder".
 *
 * The module reads process.env at import time to set `isDevBypass`.
 * We use vi.importActual and dynamic imports to test both branches.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("safeAuth", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns { userId: null } when NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY contains 'placeholder'", async () => {
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_placeholder_key");

    // Mock @clerk/nextjs/server so it doesn't throw in test env
    vi.doMock("@clerk/nextjs/server", () => ({
      auth: vi.fn().mockResolvedValue({ userId: "user_real" }),
    }));

    const { safeAuth } = await import("@/lib/safe-auth");
    const result = await safeAuth();
    expect(result).toEqual({ userId: null });
  });

  it("calls actual clerkAuth when key does NOT contain 'placeholder'", async () => {
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_real_key_123");

    const mockAuth = vi.fn().mockResolvedValue({ userId: "user_abc123" });
    vi.doMock("@clerk/nextjs/server", () => ({
      auth: mockAuth,
    }));

    const { safeAuth } = await import("@/lib/safe-auth");
    const result = await safeAuth();
    expect(result).toEqual({ userId: "user_abc123" });
    expect(mockAuth).toHaveBeenCalledOnce();
  });

  it("returns { userId: null } when env var is undefined (fallback to false, calls clerk)", async () => {
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "");

    const mockAuth = vi.fn().mockResolvedValue({ userId: "user_xyz" });
    vi.doMock("@clerk/nextjs/server", () => ({
      auth: mockAuth,
    }));

    const { safeAuth } = await import("@/lib/safe-auth");
    const result = await safeAuth();
    // Empty string does not include "placeholder", so clerk is called
    expect(result).toEqual({ userId: "user_xyz" });
    expect(mockAuth).toHaveBeenCalledOnce();
  });
});

describe("safeAuth - undefined env", () => {
  it("handles completely undefined env var (nullish coalescing to false)", async () => {
    vi.resetModules();
    // Delete the env var entirely to trigger the ?? false branch
    const original = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

    const mockAuth = vi.fn().mockResolvedValue({ userId: "user_undef" });
    vi.doMock("@clerk/nextjs/server", () => ({
      auth: mockAuth,
    }));

    const { safeAuth } = await import("@/lib/safe-auth");
    const result = await safeAuth();
    // undefined?.includes("placeholder") => undefined, ?? false => isDevBypass=false
    // So it calls clerkAuth
    expect(result).toEqual({ userId: "user_undef" });
    expect(mockAuth).toHaveBeenCalledOnce();

    // Restore
    if (original !== undefined) {
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = original;
    }
  });
});
