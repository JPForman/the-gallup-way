import { describe, expect, it } from "vitest";
import { reportSchema } from "./report";

describe("reportSchema", () => {
  it("accepts a reason with optional details", () => {
    expect(reportSchema.parse({ reason: "spam" })).toEqual({ reason: "spam" });
    expect(reportSchema.parse({ reason: "spam", details: "  ads  " })).toEqual({ reason: "spam", details: "ads" });
    expect(reportSchema.parse({ reason: "spam", details: "   " })).toEqual({ reason: "spam" });
  });

  it("requires a reason, and details for 'other'", () => {
    expect(reportSchema.safeParse({}).error?.issues[0]?.message).toBe("Choose a reason.");
    const other = reportSchema.safeParse({ reason: "other", details: " " });
    expect(other.error?.issues[0]).toMatchObject({ path: ["details"], message: "Tell us what's wrong." });
  });

  it("limits details to 1000 characters", () => {
    expect(reportSchema.safeParse({ reason: "spam", details: "x".repeat(1001) }).success).toBe(false);
  });
});
