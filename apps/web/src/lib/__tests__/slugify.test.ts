/**
 * Unit tests for lib/slugify.
 * Tests: spaces->dashes, lowercasing, special chars, collapsing repeats,
 *        max-length (120), unicode/emoji, empty input.
 */
import { describe, it, expect } from "vitest";
import { slugify } from "@/lib/slugify";

describe("slugify", () => {
  it("converts spaces to dashes", () => {
    expect(slugify("hello world")).toBe("hello-world");
  });

  it("lowercases all characters", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("replaces special characters with dashes", () => {
    expect(slugify("hello@world!")).toBe("hello-world");
  });

  it("collapses multiple consecutive non-alphanumeric chars into a single dash", () => {
    expect(slugify("hello   world")).toBe("hello-world");
    expect(slugify("foo---bar")).toBe("foo-bar");
    expect(slugify("a & b @ c")).toBe("a-b-c");
  });

  it("trims leading and trailing dashes", () => {
    expect(slugify("--hello--")).toBe("hello");
    expect(slugify("  hello  ")).toBe("hello");
    expect(slugify("!!!test!!!")).toBe("test");
  });

  it("limits output to 120 characters", () => {
    const longInput = "a".repeat(200);
    const result = slugify(longInput);
    expect(result.length).toBeLessThanOrEqual(120);
    expect(result).toBe("a".repeat(120));
  });

  it("handles max-length with dashes (slices after transformation)", () => {
    // 130 words joined by dashes exceeds 120
    const input = Array(130).fill("a").join(" ");
    const result = slugify(input);
    expect(result.length).toBeLessThanOrEqual(120);
  });

  it("strips unicode/emoji characters (non a-z0-9)", () => {
    expect(slugify("café")).toBe("caf");
    expect(slugify("hello 🌍 world")).toBe("hello-world");
    expect(slugify("日本語テスト")).toBe("");
  });

  it("returns empty string for empty input", () => {
    expect(slugify("")).toBe("");
  });

  it("returns empty string for only special chars", () => {
    expect(slugify("!!!@@@###")).toBe("");
  });

  it("handles mixed alphanumeric and numbers", () => {
    expect(slugify("Version 2.0 Release")).toBe("version-2-0-release");
  });

  it("handles already-clean slugs", () => {
    expect(slugify("already-clean")).toBe("already-clean");
  });
});
