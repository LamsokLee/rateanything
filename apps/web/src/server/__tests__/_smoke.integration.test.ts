/**
 * Smoke integration test — proves the test harness works end-to-end:
 * - DB wiring (writes to rateanything_test, not dev)
 * - Auth injection via createTestCaller
 * - Per-test reset via resetDb
 */
import { describe, it, expect, beforeEach } from "vitest";
import { resetDb, createTestCaller, TEST_USERS } from "@/test/helpers";

beforeEach(resetDb);

describe("Smoke integration tests", () => {
  it("authenticated user can create and retrieve a topic", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);

    // Create a topic with 2 options (minimum required)
    const result = await caller.topics.create({
      title: "Best Programming Languages",
      description: "Rate your favorite programming languages",
      categoryId: 1, // Sports (first seeded category)
      options: [
        { name: "TypeScript" },
        { name: "Rust" },
      ],
    });

    expect(result.id).toBeDefined();
    expect(result.slug).toContain("best-programming-languages");

    // Retrieve the topic by slug
    const topic = await caller.topics.getBySlug({ slug: result.slug });
    expect(topic.title).toBe("Best Programming Languages");
    expect(topic.options).toHaveLength(2);
    expect(topic.options[0].name).toBe("TypeScript");
    expect(topic.options[1].name).toBe("Rust");
  });

  it("guest caller can query trending topics without error", async () => {
    const guestCaller = await createTestCaller(null);

    // Should not throw — returns empty array since no topics exist
    const result = await guestCaller.topics.trending({ limit: 10 });
    expect(result).toBeDefined();
    expect(result.topics).toBeDefined();
  });
});
