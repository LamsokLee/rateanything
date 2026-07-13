/**
 * Unit tests for lib/format-date.
 * Tests: deterministic UTC formatting for Date, string, and number inputs.
 * Asserts exact 'Mon D, YYYY' output for fixed UTC instants.
 */
import { describe, it, expect } from "vitest";
import { formatDate } from "@/lib/format-date";

describe("formatDate", () => {
  // Fixed UTC instant: 2024-01-15T12:00:00.000Z
  const fixedDate = new Date("2024-01-15T12:00:00.000Z");

  it("formats a Date object as 'Mon D, YYYY'", () => {
    expect(formatDate(fixedDate)).toBe("Jan 15, 2024");
  });

  it("formats an ISO string input", () => {
    expect(formatDate("2024-01-15T12:00:00.000Z")).toBe("Jan 15, 2024");
  });

  it("formats a numeric timestamp input (milliseconds)", () => {
    const ts = new Date("2024-01-15T12:00:00.000Z").getTime();
    expect(formatDate(ts)).toBe("Jan 15, 2024");
  });

  it("formats dates at UTC midnight correctly (no off-by-one from TZ shift)", () => {
    // Midnight UTC — a TZ-unaware formatter might shift to previous day
    expect(formatDate("2024-06-01T00:00:00.000Z")).toBe("Jun 1, 2024");
  });

  it("formats dates near end of day UTC correctly", () => {
    expect(formatDate("2024-12-31T23:59:59.999Z")).toBe("Dec 31, 2024");
  });

  it("handles different months correctly", () => {
    expect(formatDate("2023-03-05T10:30:00.000Z")).toBe("Mar 5, 2023");
    expect(formatDate("2023-11-22T15:00:00.000Z")).toBe("Nov 22, 2023");
  });

  it("uses UTC timezone (not local), ensuring consistent output regardless of system TZ", () => {
    // Date at 2024-01-01 at 1am UTC — in US Pacific (UTC-8) this would be Dec 31
    // Since we force UTC, it should always be Jan 1
    const result = formatDate("2024-01-01T01:00:00.000Z");
    expect(result).toBe("Jan 1, 2024");
  });

  it("formats epoch zero correctly", () => {
    expect(formatDate(0)).toBe("Jan 1, 1970");
  });
});
