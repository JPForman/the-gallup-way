import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ThemeToggle } from "./theme-toggle";

const theme = vi.hoisted(() => ({ resolvedTheme: "light", setTheme: vi.fn() }));
vi.mock("next-themes", () => ({ useTheme: () => theme }));

describe("ThemeToggle", () => {
  it("switches light to dark", async () => {
    theme.resolvedTheme = "light";
    render(<ThemeToggle />);
    await userEvent.click(screen.getByRole("button", { name: "Toggle dark mode" }));
    expect(theme.setTheme).toHaveBeenCalledWith("dark");
  });

  it("switches dark to light", async () => {
    theme.resolvedTheme = "dark";
    render(<ThemeToggle />);
    await userEvent.click(screen.getByRole("button", { name: "Toggle dark mode" }));
    expect(theme.setTheme).toHaveBeenCalledWith("light");
  });
});
