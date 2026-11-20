import { describe, expect, it } from "vitest";
import { COMMENT_MAX, commentBodySchema } from "./comment";

describe("commentBodySchema", () => {
  it("trims", () => {
    expect(commentBodySchema.parse("  hi  ")).toBe("hi");
  });
  it("rejects blank and too long", () => {
    expect(commentBodySchema.safeParse("   ").success).toBe(false);
    expect(commentBodySchema.safeParse("x".repeat(COMMENT_MAX)).success).toBe(true);
    expect(commentBodySchema.safeParse("x".repeat(COMMENT_MAX + 1)).success).toBe(false);
  });
});
