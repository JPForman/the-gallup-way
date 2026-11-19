import { getSchema } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { editorExtensions } from "./extensions";
import { ALLOWED_MARKS, ALLOWED_NODES } from "./schema";

describe("editor schema", () => {
  const schema = getSchema(editorExtensions);

  it("has exactly the allowlisted nodes", () => {
    expect(Object.keys(schema.nodes).sort()).toEqual([...ALLOWED_NODES].sort());
  });

  it("has exactly the allowlisted marks", () => {
    expect(Object.keys(schema.marks).sort()).toEqual([...ALLOWED_MARKS].sort());
  });

  it("only offers heading levels 2 and 3", () => {
    const heading = editorExtensions[0]?.options.heading;
    expect(heading && typeof heading === "object" ? heading.levels : null).toEqual([2, 3]);
  });
});
