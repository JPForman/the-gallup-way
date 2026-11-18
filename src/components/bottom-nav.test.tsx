import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BottomNav, isActive } from "./bottom-nav";

const pathname = vi.hoisted(() => ({ value: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.value }));

describe("isActive", () => {
  it("matches home only exactly", () => {
    expect(isActive("/", "/")).toBe(true);
    expect(isActive("/search", "/")).toBe(false);
  });

  it("matches a section and its sub-paths", () => {
    expect(isActive("/saved", "/saved")).toBe(true);
    expect(isActive("/saved/2", "/saved")).toBe(true);
    expect(isActive("/savedx", "/saved")).toBe(false);
  });
});

describe("BottomNav", () => {
  beforeEach(() => {
    pathname.value = "/";
  });

  it("renders all five destinations with accessible names", () => {
    render(<BottomNav />);
    const nav = screen.getByRole("navigation", { name: "Primary" });
    for (const name of ["Home", "Search", "Write", "Saved", "Profile"]) {
      expect(nav).toContainElement(screen.getByRole("link", { name }));
    }
  });

  it("marks the current page", () => {
    pathname.value = "/search";
    render(<BottomNav />);
    expect(screen.getByRole("link", { name: "Search" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");
  });
});
