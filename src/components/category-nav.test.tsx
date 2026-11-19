import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { pathname } = vi.hoisted(() => ({ pathname: { value: "/" } }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.value }));

import { CategoryNav } from "./category-nav";

describe("CategoryNav", () => {
  it("lists every category with nothing active on the home page", () => {
    pathname.value = "/";
    render(<CategoryNav />);
    expect(screen.getAllByRole("link")).toHaveLength(8);
    expect(screen.queryByRole("link", { current: "page" })).not.toBeInTheDocument();
  });

  it("marks the current category, including its older pages", () => {
    pathname.value = "/c/sports/abc";
    render(<CategoryNav />);
    expect(screen.getByRole("link", { name: "Sports" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "News" })).not.toHaveAttribute("aria-current");
  });
});
