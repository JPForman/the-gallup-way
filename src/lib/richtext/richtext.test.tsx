import { render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  MAX_DEPTH,
  RichText,
  excerpt,
  isEmptyRichText,
  isWithinSizeLimit,
  richTextToPlain,
  safeHref,
  sanitizeRichDoc,
} from "./index";

const p = (...content: unknown[]) => ({ type: "paragraph", content });
const t = (text: string, marks?: unknown[]) => (marks ? { type: "text", text, marks } : { type: "text", text });
const doc = (...content: unknown[]) => ({ type: "doc", content });
const link = (href: unknown) => ({ type: "link", attrs: { href } });
const html = (d: unknown) => renderToStaticMarkup(<RichText doc={d} />);

describe("safeHref", () => {
  it.each([
    ["https://www.gallupnm.gov/news", "https://www.gallupnm.gov/news"],
    ["HTTP://Example.com", "http://example.com/"],
    ["  https://example.com/a b ", "https://example.com/ab"],
  ])("accepts %j", (raw, expected) => {
    expect(safeHref(raw)).toBe(expected);
  });

  it.each([
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "java\nscript:alert(1)",
    " \u0001javascript:alert(1)",
    "jav&#x09;ascript:alert(1)",
    "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    "mailto:a@b.test",
    "//evil.test/x",
    "/relative/path",
    "https://",
    "https://bank.test@evil.test/",
    "",
    42,
    null,
  ])("rejects %j", (raw) => {
    expect(safeHref(raw)).toBeNull();
  });
});

describe("safeHref length", () => {
  it("rejects URLs over 2000 characters", () => {
    expect(safeHref("https://example.com/" + "a".repeat(2000))).toBeNull();
  });
});

describe("sanitizeRichDoc", () => {
  it("keeps allowlisted structure unchanged", () => {
    const input = doc(
      { type: "heading", attrs: { level: 2 }, content: [t("Rodeo")] },
      p(t("Bold", [{ type: "bold" }]), { type: "hardBreak" }, t("site", [link("https://example.com/")])),
      { type: "bulletList", content: [{ type: "listItem", content: [p(t("one"))] }] },
      { type: "orderedList", attrs: { start: 3 }, content: [{ type: "listItem", content: [p(t("three"))] }] },
      { type: "blockquote", content: [p(t("quote"))] },
    );
    expect(sanitizeRichDoc(input)).toEqual(input);
  });

  it("returns an empty doc for non-documents", () => {
    for (const bad of [null, "text", [], { type: "paragraph" }, { type: "doc", content: "x" }]) {
      expect(sanitizeRichDoc(bad)).toEqual({ type: "doc", content: [] });
    }
  });

  it("drops unknown nodes, marks and attributes", () => {
    const out = sanitizeRichDoc(
      doc(
        { type: "html", content: [t("<script>alert(1)</script>")] },
        { type: "image", attrs: { src: "https://evil.test/x.png" } },
        { type: "iframe", attrs: { src: "https://evil.test" } },
        { type: "codeBlock", content: [t("code")] },
        {
          type: "paragraph",
          attrs: { class: "x", style: "color:red", onclick: "alert(1)" },
          content: [
            t("styled", [{ type: "textStyle", attrs: { color: "red" } }, { type: "code" }, { type: "bold", attrs: { x: 1 } }]),
            { type: "mention", attrs: { id: "x" } },
          ],
        },
      ),
    );
    expect(out).toEqual(doc(p(t("styled", [{ type: "bold" }]))));
  });

  it("removes unsafe links but keeps their text", () => {
    const out = sanitizeRichDoc(doc(p(t("click", [link("javascript:alert(1)"), { type: "italic" }]))));
    expect(out).toEqual(doc(p(t("click", [{ type: "italic" }]))));
  });

  it("normalizes headings to levels 2-3", () => {
    const out = sanitizeRichDoc(
      doc(
        { type: "heading", attrs: { level: 1 }, content: [t("a")] },
        { type: "heading", attrs: { level: 6 }, content: [t("b")] },
        { type: "heading", content: [t("c")] },
      ),
    );
    expect(out.content.map((n) => (n.type === "heading" ? n.attrs.level : null))).toEqual([2, 3, 2]);
  });

  it("drops empty text, duplicate marks and bad list starts", () => {
    const out = sanitizeRichDoc(
      doc(
        p(t(""), t("x", [{ type: "bold" }, { type: "bold" }])),
        { type: "orderedList", attrs: { start: "1; color: red" }, content: [{ type: "listItem", content: [] }] },
        { type: "bulletList", content: [p(t("not an item"))] },
      ),
    );
    expect(out).toEqual(
      doc(p(t("x", [{ type: "bold" }])), {
        type: "orderedList",
        content: [{ type: "listItem", content: [{ type: "paragraph" }] }],
      }),
    );
  });

  it("drops content nested deeper than MAX_DEPTH", () => {
    let node: unknown = p(t("deep"));
    for (let i = 0; i < MAX_DEPTH + 5; i++) node = { type: "blockquote", content: [node] };
    const out = sanitizeRichDoc(doc(node));
    expect(richTextToPlain(out)).toBe("");
    expect(JSON.stringify(out).length).toBeLessThan(1000);
  });

  it("enforces the stored size limit", () => {
    expect(isWithinSizeLimit(sanitizeRichDoc(doc(p(t("a".repeat(1000))))))).toBe(true);
    expect(isWithinSizeLimit(sanitizeRichDoc(doc(p(t("é".repeat(60_000))))))).toBe(false);
  });
});

describe("RichText renderer", () => {
  it("renders allowlisted elements", () => {
    const out = html(
      doc(
        { type: "heading", attrs: { level: 3 }, content: [t("Sub")] },
        p(t("a", [{ type: "bold" }, { type: "italic" }]), { type: "hardBreak" }, t("b")),
        { type: "orderedList", attrs: { start: 2 }, content: [{ type: "listItem", content: [p(t("two"))] }] },
      ),
    );
    expect(out).toBe(
      '<div class="richtext"><h3>Sub</h3><p><em><strong>a</strong></em><br/>b</p><ol start="2"><li><p>two</p></li></ol></div>',
    );
  });

  it("escapes text instead of interpreting HTML", () => {
    const out = html(doc(p(t('<script>alert(1)</script><img src=x onerror="alert(1)">'))));
    expect(out).not.toContain("<script");
    expect(out).not.toContain("<img");
    expect(out).toContain("&lt;script&gt;");
  });

  it("renders safe links with UGC rel and drops unsafe ones", () => {
    const { container } = render(
      <RichText
        doc={doc(p(t("good", [link("https://example.com/")]), t(" bad", [link("javascript:alert(1)")])))}
      />,
    );
    const anchors = container.querySelectorAll("a");
    expect(anchors).toHaveLength(1);
    expect(anchors[0]?.getAttribute("href")).toBe("https://example.com/");
    expect(anchors[0]?.getAttribute("rel")).toBe("nofollow ugc noopener noreferrer");
    expect(container.textContent).toBe("good bad");
  });

  it("never emits attributes from the input", () => {
    const out = html(
      doc({ type: "paragraph", attrs: { onclick: "alert(1)", style: "x" }, content: [t("hi")] }),
    );
    expect(out).toBe('<div class="richtext"><p>hi</p></div>');
  });

  it("renders nothing for garbage", () => {
    expect(html("<b>hi</b>")).toBe('<div class="richtext"></div>');
  });
});

describe("plain text", () => {
  it("matches public.richtext_plain() (same fixture as 040_articles.test.sql)", () => {
    const fixture = doc(
      p(t("Hel"), t("lo", [{ type: "bold" }])),
      { type: "bulletList", content: [{ type: "listItem", content: [p(t("one"))] }] },
    );
    expect(richTextToPlain(fixture)).toBe("Hello\none");
  });

  it("separates blocks and keeps hard breaks", () => {
    expect(
      richTextToPlain(doc(p(t("a"), { type: "hardBreak" }, t("b")), { type: "paragraph" }, p(t("c")))),
    ).toBe("a\nb\nc");
  });

  it("detects empty bodies", () => {
    expect(isEmptyRichText(doc(p(), p(t("   "))))).toBe(true);
    expect(isEmptyRichText(doc(p(t("x"))))).toBe(false);
  });

  it("builds word-boundary excerpts", () => {
    expect(excerpt("short")).toBe("short");
    expect(excerpt("one two three four five", 12)).toBe("one two…");
    expect(excerpt("a\n\nb   c")).toBe("a b c");
  });
});
