import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PublicArticle } from "@/lib/db/articles";
import { SITE_NAME } from "@/lib/site";
import { ArticleView, articleKicker, formatArticleDate } from "./article-view";

function story(overrides: Partial<PublicArticle> = {}): PublicArticle {
  return {
    id: "a1",
    author_id: "u1",
    slug: "fair-opens-abc123",
    title: "County fair opens Friday",
    dek: "Gates at nine",
    body_json: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Rides and food." }] }] },
    category: "events",
    content_type: "news",
    published_at: "2026-11-18T18:00:00Z",
    edited_at: null,
    author: { handle: "ana", display_name: "Ana Begay", avatar_path: null },
    sources: [],
    images: [],
    corrections: [],
    ...overrides,
  };
}

const url = (p: string) => `https://cdn.test/${p}`;

describe("articleKicker", () => {
  it("joins category and story type", () => {
    expect(articleKicker({ category: "events", content_type: "news" })).toBe("Events · News report");
  });
  it("doesn't repeat a matching type", () => {
    expect(articleKicker({ category: "community", content_type: "community" })).toBe("Community");
    expect(articleKicker({ category: "news", content_type: "news" })).toBe("News report");
  });
  it("labels opinion pieces by type or category", () => {
    expect(articleKicker({ category: "news", content_type: "opinion" })).toBe("Opinion");
    expect(articleKicker({ category: "opinion", content_type: "news" })).toBe("Opinion");
  });
});

describe("ArticleView", () => {
  it("shows headline, byline, date and the disclaimer", () => {
    render(<ArticleView article={story()} imageUrl={url} />);
    expect(screen.getByRole("heading", { level: 1, name: "County fair opens Friday" })).toBeInTheDocument();
    expect(screen.getByText("Gates at nine")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ana Begay" })).toHaveAttribute("href", "/u/ana");
    expect(screen.getByText(/Posted by a community member/)).toBeInTheDocument();
    expect(screen.getByText("November 18, 2026")).toBeInTheDocument();
    expect(screen.queryByText(/Updated/)).not.toBeInTheDocument();
    expect(screen.getByText("Rides and food.")).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Disclaimer" })).toHaveTextContent(
      `have not been independently verified by ${SITE_NAME}`,
    );
    expect(screen.queryByText(/This piece shares the author/)).not.toBeInTheDocument();
  });

  it("shows the updated date, a former member, and the opinion note", () => {
    render(
      <ArticleView
        article={story({ author: null, content_type: "opinion", edited_at: "2026-11-20T18:00:00Z" })}
        imageUrl={url}
      />,
    );
    expect(screen.getByText(/Updated/)).toHaveTextContent("Updated November 20, 2026");
    expect(screen.getByText("Former member")).toBeInTheDocument();
    expect(screen.getByText(/This piece shares the author/)).toBeInTheDocument();
  });

  it("renders images with captions and credits, sources and corrections", () => {
    render(
      <ArticleView
        article={story({
          images: [
            { storage_path: "u/a/lead.webp", alt_text: "The midway at dusk", caption: "Opening night.", credit: "Ana" },
            { storage_path: "u/a/two.webp", alt_text: "Prize cattle", caption: null, credit: null },
          ],
          sources: [
            { url: "https://example.org/fair", label: "Fair schedule" },
            { url: "javascript:alert(1)", label: "Bad link" },
          ],
          corrections: [{ id: 1, body: "It opens Friday, not Thursday.", created_at: "2026-11-19T18:00:00Z" }],
        })}
        imageUrl={url}
      />,
    );
    expect(screen.getByRole("img", { name: "The midway at dusk" })).toHaveAttribute("src", "https://cdn.test/u/a/lead.webp");
    expect(screen.getByText("Opening night. Photo: Ana")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Prize cattle" })).toHaveAttribute("loading", "lazy");

    const sources = within(screen.getByRole("region", { name: "Sources" }));
    expect(sources.getByRole("link", { name: "Fair schedule" })).toHaveAttribute("rel", "nofollow ugc noopener noreferrer");
    expect(sources.queryByRole("link", { name: "Bad link" })).not.toBeInTheDocument();
    expect(sources.getByText("Bad link")).toBeInTheDocument();

    expect(screen.getByRole("list", { name: "Corrections" })).toHaveTextContent("It opens Friday, not Thursday.");
  });

  it("formats dates in Gallup's time zone", () => {
    expect(formatArticleDate("2026-11-19T03:00:00Z")).toBe("November 18, 2026");
  });
});
