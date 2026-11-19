import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { FeedItem } from "@/lib/db/articles";
import { StoryCard, StoryGrid } from "./story-card";

function item(overrides: Partial<FeedItem> = {}): FeedItem {
  return {
    id: "abab0000-0000-0000-0000-000000000001",
    slug: "rodeo-abc123",
    title: "Rodeo grounds reopen",
    dek: null,
    excerpt: "The rodeo grounds reopen this weekend after repairs to the bleachers.",
    category: "sports",
    content_type: "news",
    published_at: "2026-11-18T18:00:00Z",
    author_handle: "ana",
    author_display_name: "Ana Begay",
    image_path: null,
    image_alt: null,
    ...overrides,
  };
}

const url = (p: string) => `https://cdn.test/${p}`;

describe("StoryCard", () => {
  it("links the headline and shows kicker, byline and date", () => {
    render(<StoryCard item={item()} imageUrl={url} />);
    expect(screen.getByRole("link", { name: "Rodeo grounds reopen" })).toHaveAttribute("href", "/a/rodeo-abc123");
    expect(screen.getByText("Sports · News report")).toBeInTheDocument();
    expect(screen.getByText("Ana Begay")).toBeInTheDocument();
    expect(screen.getByText("November 18, 2026")).toBeInTheDocument();
    expect(screen.getByText(/The rodeo grounds reopen this weekend/)).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("prefers the summary and shows the lead image", () => {
    render(
      <StoryCard
        lead
        item={item({ dek: "New bleachers are in.", image_path: "u/a/lead.webp", image_alt: "Bleachers" })}
        imageUrl={url}
      />,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Rodeo grounds reopen" })).toBeInTheDocument();
    expect(screen.getByText("New bleachers are in.")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Bleachers" })).toHaveAttribute("src", "https://cdn.test/u/a/lead.webp");
  });

  it("shows Former member when the author is gone", () => {
    render(<StoryCard item={item({ author_display_name: null, author_handle: null })} imageUrl={url} />);
    expect(screen.getByText("Former member")).toBeInTheDocument();
  });
});

describe("StoryGrid", () => {
  it("renders one list item per story", () => {
    render(<StoryGrid items={[item(), item({ id: "2", slug: "b", title: "Second" })]} imageUrl={url} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });
});
