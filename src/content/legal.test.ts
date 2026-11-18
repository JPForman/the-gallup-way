import { describe, expect, it } from "vitest";
import { LEGAL_LINKS } from "@/lib/site";
import { LEGAL_PAGES, isLegalSlug } from "./legal";

describe("legal content", () => {
  it("has a page for every /legal footer link", () => {
    const slugs = LEGAL_LINKS.filter((l) => l.href.startsWith("/legal/")).map((l) =>
      l.href.replace("/legal/", ""),
    );
    expect(slugs.length).toBeGreaterThan(0);
    for (const slug of slugs) expect(isLegalSlug(slug)).toBe(true);
  });

  it("rejects unknown and prototype slugs", () => {
    expect(isLegalSlug("nope")).toBe(false);
    expect(isLegalSlug("toString")).toBe(false);
  });

  it("gives every page at least one non-empty section", () => {
    for (const page of Object.values(LEGAL_PAGES)) {
      expect(page.sections.length).toBeGreaterThan(0);
      for (const s of page.sections) expect(s.body.join("").trim()).not.toBe("");
    }
  });
});
