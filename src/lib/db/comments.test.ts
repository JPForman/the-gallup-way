import { describe, expect, it } from "vitest";
import { buildThreads, type CommentRow } from "./comments";

function c(id: number, parent: number | null, deleted = false): CommentRow {
  return {
    id,
    parent_id: parent,
    author_id: "u",
    body: deleted ? "" : `c${id}`,
    created_at: "2026-11-19T18:00:00Z",
    deleted_at: deleted ? "2026-11-19T19:00:00Z" : null,
    removed_at: null,
    author: null,
  };
}

describe("buildThreads", () => {
  it("groups replies under their comment, in order", () => {
    const threads = buildThreads([c(1, null), c(2, null)], [c(3, 1), c(4, 2), c(5, 1)]);
    expect(threads.map((t) => [t.comment.id, t.replies.map((r) => r.id)])).toEqual([
      [1, [3, 5]],
      [2, [4]],
    ]);
  });

  it("keeps a deleted comment only while it has replies, and drops deleted replies", () => {
    const threads = buildThreads([c(1, null, true), c(2, null, true), c(3, null)], [c(4, 1), c(5, 2, true)]);
    expect(threads.map((t) => [t.comment.id, t.replies.map((r) => r.id)])).toEqual([
      [1, [4]],
      [3, []],
    ]);
  });
});
