import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LEGAL_LINKS, SITE_NAME } from "@/lib/site";
import { SiteFooter } from "./site-footer";

describe("SiteFooter", () => {
  it("links every required legal page", () => {
    render(<SiteFooter />);
    const nav = screen.getByRole("navigation", { name: "Legal" });
    for (const label of [
      "Terms",
      "Privacy",
      "Community Guidelines",
      "Copyright/DMCA",
      "Contact",
    ]) {
      expect(within(nav).getByRole("link", { name: label })).toBeInTheDocument();
    }
    expect(within(nav).getAllByRole("link")).toHaveLength(LEGAL_LINKS.length);
  });

  it("states that posts are not written or verified by the site", () => {
    render(<SiteFooter />);
    expect(
      screen.getByText(new RegExp(`not written, edited or independently verified by\\s+${SITE_NAME}`)),
    ).toBeInTheDocument();
  });
});
