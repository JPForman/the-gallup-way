import { describe, expect, it } from "vitest";
import { parseSearchParams, SEARCH_MAX_LENGTH, SEARCH_MAX_PAGE, searchHref } from "./params";

describe("parseSearchParams", () => {
  it("defaults", () => {
    expect(parseSearchParams({})).toEqual({ q: "", tab: "stories", page: 1 });
  });

  it("collapses whitespace and caps the length", () => {
    expect(parseSearchParams({ q: "  farmers   market " }).q).toBe("farmers market");
    expect(parseSearchParams({ q: "x".repeat(300) }).q).toHaveLength(SEARCH_MAX_LENGTH);
  });

  it("accepts only known tabs and sane pages", () => {
    expect(parseSearchParams({ tab: "writers" }).tab).toBe("writers");
    expect(parseSearchParams({ tab: "admin" }).tab).toBe("stories");
    expect(parseSearchParams({ page: "3" }).page).toBe(3);
    expect(parseSearchParams({ page: "-2" }).page).toBe(1);
    expect(parseSearchParams({ page: "abc" }).page).toBe(1);
    expect(parseSearchParams({ page: "9999" }).page).toBe(SEARCH_MAX_PAGE);
  });

  it("uses the first value of repeated params", () => {
    expect(parseSearchParams({ q: ["rodeo", "market"] }).q).toBe("rodeo");
  });
});

describe("searchHref", () => {
  it("omits defaults", () => {
    expect(searchHref({})).toBe("/search");
    expect(searchHref({ q: "rodeo", tab: "stories", page: 1 })).toBe("/search?q=rodeo");
    expect(searchHref({ q: "green chile", tab: "writers", page: 2 })).toBe("/search?q=green+chile&tab=writers&page=2");
  });
});
