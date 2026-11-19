import { describe, expect, it } from "vitest";
import { isArticleImagePath, parseArticleForm } from "./article";

const USER = "11111111-1111-4111-8111-111111111111";
const ARTICLE = "22222222-2222-4222-8222-222222222222";
const body = JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hi" }] }] });

function form(fields: Record<string, string | string[]>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    for (const item of Array.isArray(v) ? v : [v]) fd.append(k, item);
  }
  return fd;
}

const base = { articleId: ARTICLE, title: " Rodeo week ", dek: "", category: "events", contentType: "event", body };

describe("parseArticleForm", () => {
  it("parses a complete form", () => {
    const r = parseArticleForm(
      form({
        ...base,
        sourceUrl: ["https://example.com/a", "", " http://example.com/b "],
        sourceLabel: ["Fair board", "", ""],
        imagePath: [`${USER}/${ARTICLE}/abc-123.webp`],
        imageAlt: [" Bull rider "],
        imageCaption: [""],
        imageCredit: ["Ana"],
      }),
      USER,
    );
    expect(r).toEqual({
      ok: true,
      data: {
        articleId: ARTICLE,
        title: "Rodeo week",
        dek: undefined,
        category: "events",
        contentType: "event",
        body: JSON.parse(body),
        sources: [
          { url: "https://example.com/a", label: "Fair board" },
          { url: "http://example.com/b", label: null },
        ],
        images: [{ storage_path: `${USER}/${ARTICLE}/abc-123.webp`, alt_text: "Bull rider", caption: null, credit: "Ana" }],
      },
    });
  });

  it("allows an empty new draft id and empty category", () => {
    const r = parseArticleForm(form({ ...base, articleId: "", category: "" }), USER);
    expect(r.ok && r.data.articleId === undefined && r.data.category === undefined).toBe(true);
  });

  it("sanitizes the body", () => {
    const evil = JSON.stringify({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }] }, { type: "iframe" }],
    });
    const r = parseArticleForm(form({ ...base, body: evil }), USER);
    expect(r.ok && r.data.body).toEqual({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "x" }] }] });
  });

  it.each([
    [{ title: "x".repeat(121) }, "title"],
    [{ dek: "x".repeat(241) }, "dek"],
    [{ category: "weather" }, "category"],
    [{ contentType: "rumor" }, "contentType"],
    [{ articleId: "not-a-uuid" }, "articleId"],
    [{ body: "{not json" }, "body"],
  ])("rejects %j", (override, field) => {
    const r = parseArticleForm(form({ ...base, ...override }), USER);
    expect(r.ok).toBe(false);
    expect(!r.ok && Object.keys(r.fieldErrors)).toContain(field);
  });

  it("rejects unsafe or partial source URLs", () => {
    const r = parseArticleForm(
      form({ ...base, sourceUrl: ["javascript:alert(1)", "example.com"], sourceLabel: ["", "x"] }),
      USER,
    );
    expect(!r.ok && r.fieldErrors.sources).toHaveLength(2);
  });

  it("rejects more than 10 sources", () => {
    const urls = Array.from({ length: 11 }, (_, i) => `https://example.com/${i}`);
    const r = parseArticleForm(form({ ...base, sourceUrl: urls, sourceLabel: urls.map(() => "") }), USER);
    expect(!r.ok && r.fieldErrors.sources).toEqual(["Add at most 10 sources."]);
  });

  it("requires photo descriptions and the caller's folder", () => {
    const r = parseArticleForm(
      form({
        ...base,
        imagePath: [`${USER}/${ARTICLE}/a.webp`, `33333333-3333-4333-8333-333333333333/${ARTICLE}/b.webp`],
        imageAlt: ["", "x"],
        imageCaption: ["", ""],
        imageCredit: ["", ""],
      }),
      USER,
    );
    expect(!r.ok && r.fieldErrors.images).toEqual([
      "Photo 1: describe the photo for people who can't see it.",
      "Photo 2: that upload isn't valid. Remove it and try again.",
    ]);
  });

  it("rejects photos on a story that hasn't been saved yet", () => {
    const r = parseArticleForm(
      form({ ...base, articleId: "", imagePath: [`${USER}/${ARTICLE}/a.webp`], imageAlt: ["x"] }),
      USER,
    );
    expect(r.ok).toBe(false);
  });
});

describe("isArticleImagePath", () => {
  it.each([
    [`${USER}/${ARTICLE}/a-1.webp`, true],
    [`${USER}/${ARTICLE}/../x.webp`, false],
    [`${USER}/${ARTICLE}/a.png`, false],
    [`${USER}/${ARTICLE}/sub/a.webp`, false],
    [`${ARTICLE}/${USER}/a.webp`, false],
  ])("%s -> %s", (path, ok) => {
    expect(isArticleImagePath(path, USER, ARTICLE)).toBe(ok);
  });
});
