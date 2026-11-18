import { describe, expect, it } from "vitest";
import { formatDateLine } from "./date-line";

describe("formatDateLine", () => {
  it("formats in Gallup's time zone, upper-cased", () => {
    expect(formatDateLine(new Date("2026-11-18T18:00:00Z"))).toBe("WEDNESDAY, NOVEMBER 18, 2026");
  });

  it("uses Mountain time, not UTC, near midnight", () => {
    // 03:00 UTC on Nov 19 is still Nov 18 in Gallup (UTC-7).
    expect(formatDateLine(new Date("2026-11-19T03:00:00Z"))).toBe("WEDNESDAY, NOVEMBER 18, 2026");
  });
});
