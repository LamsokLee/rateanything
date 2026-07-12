/**
 * Unit tests for Zod validation schemas.
 * Tests the exact constraints from moderation.report and topics.create.
 */
import { describe, it, expect } from "vitest";
import { reportInputSchema, topicCreateInputSchema } from "../schemas";

describe("reportInputSchema", () => {
  const validInput = {
    targetType: "topic" as const,
    targetId: "550e8400-e29b-41d4-a716-446655440000",
    reason: "spam" as const,
  };

  it("accepts valid report with all valid reasons", () => {
    const reasons = ["spam", "harassment", "hate_speech", "off_topic", "private_individual", "other"] as const;
    for (const reason of reasons) {
      const result = reportInputSchema.safeParse({ ...validInput, reason });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid reason", () => {
    const result = reportInputSchema.safeParse({ ...validInput, reason: "invalid_reason" });
    expect(result.success).toBe(false);
  });

  it("rejects empty reason", () => {
    const result = reportInputSchema.safeParse({ ...validInput, reason: "" });
    expect(result.success).toBe(false);
  });

  it("accepts valid targetTypes", () => {
    const types = ["topic", "rating", "comment", "user"] as const;
    for (const targetType of types) {
      const result = reportInputSchema.safeParse({ ...validInput, targetType });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid targetType", () => {
    const result = reportInputSchema.safeParse({ ...validInput, targetType: "post" });
    expect(result.success).toBe(false);
  });

  it("rejects non-UUID targetId", () => {
    const result = reportInputSchema.safeParse({ ...validInput, targetId: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("accepts optional details", () => {
    const result = reportInputSchema.safeParse({ ...validInput, details: "Some details" });
    expect(result.success).toBe(true);
  });

  it("rejects details exceeding 1000 chars", () => {
    const result = reportInputSchema.safeParse({ ...validInput, details: "x".repeat(1001) });
    expect(result.success).toBe(false);
  });
});

describe("topicCreateInputSchema", () => {
  const validInput = {
    title: "Best Programming Languages",
    categoryId: 1,
    options: [
      { name: "Rust" },
      { name: "TypeScript" },
    ],
  };

  describe("title validation", () => {
    it("accepts valid title (5-100 chars)", () => {
      const result = topicCreateInputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("rejects title shorter than 5 characters", () => {
      const result = topicCreateInputSchema.safeParse({ ...validInput, title: "Hi" });
      expect(result.success).toBe(false);
    });

    it("rejects title exactly 4 characters", () => {
      const result = topicCreateInputSchema.safeParse({ ...validInput, title: "ABCD" });
      expect(result.success).toBe(false);
    });

    it("accepts title exactly 5 characters", () => {
      const result = topicCreateInputSchema.safeParse({ ...validInput, title: "ABCDE" });
      expect(result.success).toBe(true);
    });

    it("rejects title exceeding 100 characters", () => {
      const result = topicCreateInputSchema.safeParse({ ...validInput, title: "x".repeat(101) });
      expect(result.success).toBe(false);
    });

    it("accepts title exactly 100 characters", () => {
      const result = topicCreateInputSchema.safeParse({ ...validInput, title: "x".repeat(100) });
      expect(result.success).toBe(true);
    });
  });

  describe("options validation", () => {
    it("rejects fewer than 2 options", () => {
      const result = topicCreateInputSchema.safeParse({
        ...validInput,
        options: [{ name: "Only one" }],
      });
      expect(result.success).toBe(false);
    });

    it("rejects empty options array", () => {
      const result = topicCreateInputSchema.safeParse({
        ...validInput,
        options: [],
      });
      expect(result.success).toBe(false);
    });

    it("accepts exactly 2 options (minimum)", () => {
      const result = topicCreateInputSchema.safeParse({
        ...validInput,
        options: [{ name: "A" }, { name: "B" }],
      });
      expect(result.success).toBe(true);
    });

    it("accepts 20 options (maximum)", () => {
      const result = topicCreateInputSchema.safeParse({
        ...validInput,
        options: Array.from({ length: 20 }, (_, i) => ({ name: `Option ${i}` })),
      });
      expect(result.success).toBe(true);
    });

    it("rejects more than 20 options", () => {
      const result = topicCreateInputSchema.safeParse({
        ...validInput,
        options: Array.from({ length: 21 }, (_, i) => ({ name: `Option ${i}` })),
      });
      expect(result.success).toBe(false);
    });

    it("rejects option with empty name", () => {
      const result = topicCreateInputSchema.safeParse({
        ...validInput,
        options: [{ name: "" }, { name: "Valid" }],
      });
      expect(result.success).toBe(false);
    });

    it("rejects option name exceeding 200 chars", () => {
      const result = topicCreateInputSchema.safeParse({
        ...validInput,
        options: [{ name: "x".repeat(201) }, { name: "Valid" }],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("optional fields", () => {
    it("accepts valid description", () => {
      const result = topicCreateInputSchema.safeParse({
        ...validInput,
        description: "A description",
      });
      expect(result.success).toBe(true);
    });

    it("rejects description exceeding 2000 chars", () => {
      const result = topicCreateInputSchema.safeParse({
        ...validInput,
        description: "x".repeat(2001),
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid imageUrl", () => {
      const result = topicCreateInputSchema.safeParse({
        ...validInput,
        imageUrl: "not-a-url",
      });
      expect(result.success).toBe(false);
    });

    it("accepts valid imageUrl", () => {
      const result = topicCreateInputSchema.safeParse({
        ...validInput,
        imageUrl: "https://example.com/img.png",
      });
      expect(result.success).toBe(true);
    });
  });
});
