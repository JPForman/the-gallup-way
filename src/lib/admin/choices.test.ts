import { describe, expect, it } from "vitest";

import { articleChoices } from "@/lib/admin/choices";

const actions = (status: string, locked = false) => articleChoices({ status, comments_locked: locked }).map((c) => c.action);

describe("articleChoices", () => {
  it("offers the right buttons for each status", () => {
    expect(actions("pending_review")).toEqual(["approve", "reject", "hide"]);
    expect(actions("published")).toEqual(["hide", "lock_comments"]);
    expect(actions("published", true)).toEqual(["hide", "unlock_comments"]);
    expect(actions("hidden")).toEqual(["restore"]);
    expect(actions("draft")).toEqual([]);
  });
});
