import { describe, expect, it } from "vitest";
import { parseModerationForm } from "./moderation";

function form(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

const ID = "5a5a0000-0000-4000-8000-000000000101";

describe("parseModerationForm", () => {
  it("parses story, comment and report actions", () => {
    expect(parseModerationForm(form({ kind: "article", id: ID, action: "hide", reason: " Spam ", reportId: "3" })).data).toEqual({
      kind: "article",
      id: ID,
      action: "hide",
      reason: "Spam",
      reportId: 3,
    });
    expect(parseModerationForm(form({ kind: "comment", id: "12", action: "remove", reason: "Attack" })).data).toMatchObject({
      kind: "comment",
      id: 12,
    });
    expect(parseModerationForm(form({ kind: "report", id: "9", action: "dismiss", reason: "Fine" })).success).toBe(true);
  });

  it("requires a reason", () => {
    const r = parseModerationForm(form({ kind: "article", id: ID, action: "hide", reason: "  " }));
    expect(r.error?.issues[0]).toMatchObject({ path: ["reason"] });
  });

  it("rejects actions that don't fit the item", () => {
    expect(parseModerationForm(form({ kind: "comment", id: "12", action: "hide", reason: "x" })).success).toBe(false);
    expect(parseModerationForm(form({ kind: "article", id: "not-a-uuid", action: "hide", reason: "x" })).success).toBe(false);
  });

  it("parses account, role and note actions", () => {
    expect(parseModerationForm(form({ kind: "user", id: ID, action: "suspend_7", reason: "Spam" })).success).toBe(true);
    expect(parseModerationForm(form({ kind: "user", id: ID, action: "delete", reason: "x" })).success).toBe(false);
    expect(parseModerationForm(form({ kind: "role", id: ID, action: "set_role", role: "moderator", reason: "Trusted" })).data).toMatchObject({
      role: "moderator",
    });
    expect(parseModerationForm(form({ kind: "role", id: ID, action: "set_role", role: "owner", reason: "x" })).success).toBe(false);
    expect(parseModerationForm(form({ kind: "note", id: ID, action: "note", reason: "Warned by email" })).success).toBe(true);
  });
});
