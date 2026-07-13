/**
 * Unit tests for lib/chart-colors.
 * Tests: palette length, deterministic index selection via modulo wrapping.
 */
import { describe, it, expect } from "vitest";
import { CHART_COLORS } from "@/lib/chart-colors";

describe("CHART_COLORS", () => {
  it("exports an array of exactly 8 colors", () => {
    expect(CHART_COLORS).toHaveLength(8);
  });

  it("each color is a valid hex color string", () => {
    for (const color of CHART_COLORS) {
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it("contains the expected palette values", () => {
    expect(CHART_COLORS[0]).toBe("#4F8DF0"); // blue
    expect(CHART_COLORS[1]).toBe("#FF6B6B"); // coral red
    expect(CHART_COLORS[2]).toBe("#4ECB71"); // green
    expect(CHART_COLORS[3]).toBe("#F0A94F"); // orange
    expect(CHART_COLORS[4]).toBe("#A855F7"); // purple
    expect(CHART_COLORS[5]).toBe("#06b6d4"); // cyan
    expect(CHART_COLORS[6]).toBe("#ec4899"); // pink
    expect(CHART_COLORS[7]).toBe("#eab308"); // yellow
  });

  it("modulo wrapping provides deterministic color selection", () => {
    // The app uses idx % CHART_COLORS.length to pick colors
    const getColor = (idx: number) => CHART_COLORS[idx % CHART_COLORS.length];

    expect(getColor(0)).toBe("#4F8DF0");
    expect(getColor(7)).toBe("#eab308");
    // Wraps around
    expect(getColor(8)).toBe("#4F8DF0");
    expect(getColor(9)).toBe("#FF6B6B");
    expect(getColor(16)).toBe("#4F8DF0");
  });

  it("colors are all unique (no duplicates)", () => {
    const unique = new Set(CHART_COLORS);
    expect(unique.size).toBe(CHART_COLORS.length);
  });
});
