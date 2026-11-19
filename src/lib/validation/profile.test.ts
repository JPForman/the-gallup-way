import { describe, expect, it } from "vitest";
import { profileUpdateSchema } from "./profile";

const base = { displayName: "Jo", handle: "jo_b", bio: "", avatarPath: "" };
const uid = "bbbbbbbb-0000-0000-0000-000000000001";

describe("profileUpdateSchema", () => {
  it("turns an empty bio into null", () => {
    expect(profileUpdateSchema.parse(base).bio).toBeNull();
  });

  it("accepts a new avatar in a user folder, or 'remove'", () => {
    expect(profileUpdateSchema.safeParse({ ...base, avatarPath: `${uid}/abc-123.webp` }).success).toBe(true);
    expect(profileUpdateSchema.safeParse({ ...base, avatarPath: "remove" }).success).toBe(true);
  });

  it.each([`${uid}/../x.webp`, `${uid}/a.png`, "a.webp", `${uid}/A.webp`])(
    "rejects avatar path %s",
    (avatarPath) => {
      expect(profileUpdateSchema.safeParse({ ...base, avatarPath }).success).toBe(false);
    },
  );

  it("limits bio length", () => {
    expect(profileUpdateSchema.safeParse({ ...base, bio: "x".repeat(501) }).success).toBe(false);
  });
});
