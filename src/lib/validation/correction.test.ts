import { describe, expect, it } from "vitest";
import { CORRECTION_MAX, parseCorrectionForm } from "./correction";

const ID = "eeeeeeee-0000-4000-8000-000000000001";

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe("parseCorrectionForm", () => {
  it("trims the text", () => {
    const r = parseCorrectionForm(form({ articleId: ID, body: "  The fair opens Friday.  " }));
    expect(r.success && r.data).toEqual({ articleId: ID, body: "The fair opens Friday." });
  });

  it("rejects blank text", () => {
    const r = parseCorrectionForm(form({ articleId: ID, body: "   " }));
    expect(r.success).toBe(false);
  });

  it("rejects text over the limit", () => {
    expect(parseCorrectionForm(form({ articleId: ID, body: "x".repeat(CORRECTION_MAX) })).success).toBe(true);
    expect(parseCorrectionForm(form({ articleId: ID, body: "x".repeat(CORRECTION_MAX + 1) })).success).toBe(false);
  });

  it("rejects a missing or invalid article id", () => {
    expect(parseCorrectionForm(form({ body: "Fix" })).success).toBe(false);
    expect(parseCorrectionForm(form({ articleId: "nope", body: "Fix" })).success).toBe(false);
  });
});
