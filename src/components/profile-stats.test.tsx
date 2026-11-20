import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProfileStatsList, statItems } from "./profile-stats";

describe("ProfileStatsList", () => {
  it("shows each stat with singular and plural words", () => {
    render(<ProfileStatsList stats={{ stories: 1, likes: 1234, comments: 0, views: 1 }} />);
    expect(screen.getAllByRole("definition")).toHaveLength(4);
    expect(statItems({ stories: 1, likes: 1234, comments: 0, views: 1 }).map((i) => i.value)).toEqual([
      "1 story",
      "1,234 likes",
      "0 comments",
      "1 read",
    ]);
    expect(screen.getByText("1,234")).toBeInTheDocument();
  });

  it("renders nothing for people without published stories", () => {
    const { container } = render(<ProfileStatsList stats={{ stories: 0, likes: 0, comments: 0, views: 0 }} />);
    expect(container).toBeEmptyDOMElement();
  });
});
