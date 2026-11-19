import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Avatar } from "./avatar";

describe("Avatar", () => {
  it("shows initials when there is no photo", () => {
    render(<Avatar name="Jo Ann Begay" src={null} />);
    expect(screen.getByText("JB")).toBeInTheDocument();
  });

  it("renders a decorative image when there is a photo", () => {
    const { container } = render(<Avatar name="Jo" src="https://example.test/a.webp" />);
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("alt", "");
  });
});
