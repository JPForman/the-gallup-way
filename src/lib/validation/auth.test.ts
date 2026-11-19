import { describe, expect, it } from "vitest";
import { signUpSchema, updatePasswordSchema } from "./auth";

const valid = {
  email: "  Resident@Example.com ",
  password: "correct horse",
  displayName: " Jo Begay ",
  handle: "@Jo_Begay",
  ageConfirmed: "on",
  acceptTerms: "on",
};

describe("signUpSchema", () => {
  it("accepts and normalizes valid input", () => {
    const r = signUpSchema.parse(valid);
    expect(r.email).toBe("resident@example.com");
    expect(r.handle).toBe("jo_begay");
    expect(r.displayName).toBe("Jo Begay");
  });

  it.each([
    ["ageConfirmed", undefined, "18 or older"],
    ["acceptTerms", undefined, "Terms"],
    ["password", "short", "8 characters"],
    ["handle", "admin", "reserved"],
    ["email", "not-an-email", "valid email"],
  ])("rejects bad %s", (field, value, message) => {
    const r = signUpSchema.safeParse({ ...valid, [field]: value });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain(message);
  });
});

describe("updatePasswordSchema", () => {
  it("requires matching passwords", () => {
    const r = updatePasswordSchema.safeParse({ password: "longenough", confirm: "different1" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["confirm"]);
  });
});
