import { describe, expect, it } from "vitest";
import { deleteAccountSchema } from "./account";

describe("deleteAccountSchema", () => {
  it("needs a mode, a password and DELETE typed", () => {
    expect(deleteAccountSchema.safeParse({ mode: "anonymize", password: "pw", confirm: " delete " }).success).toBe(true);
    const bad = deleteAccountSchema.safeParse({ mode: "erase", password: "", confirm: "yes" });
    expect(bad.error?.issues.map((i) => i.path[0]).sort()).toEqual(["confirm", "mode", "password"]);
  });
});
