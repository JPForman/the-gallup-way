import { describe, expect, it } from "vitest";
import { safeNext } from "./redirect";

describe("safeNext", () => {
  it.each([
    ["/write", "/write"],
    ["/a/some-story?x=1", "/a/some-story?x=1"],
    ["//evil.example", "/"],
    ["/\\evil.example", "/"],
    ["https://evil.example", "/"],
    ["javascript:alert(1)", "/"],
    ["/ok\nSet-Cookie:x", "/"],
    [undefined, "/"],
    [42, "/"],
  ])("safeNext(%j) -> %s", (input, expected) => {
    expect(safeNext(input)).toBe(expected);
  });
});
