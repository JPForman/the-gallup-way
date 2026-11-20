import { describe, expect, it } from "vitest";

import { articleChoices, userChoices } from "@/lib/admin/choices";
import { accountStatus } from "@/lib/db/admin";

const actions = (status: string, locked = false) => articleChoices({ status, comments_locked: locked }).map((c) => c.action);

describe("articleChoices", () => {
  it("offers the right buttons for each status", () => {
    expect(actions("pending_review")).toEqual(["approve", "reject", "hide"]);
    expect(actions("published")).toEqual(["hide", "lock_comments"]);
    expect(actions("published", true)).toEqual(["hide", "unlock_comments"]);
    expect(actions("hidden")).toEqual(["restore"]);
    expect(actions("draft")).toEqual([]);
    expect(articleChoices({ status: "published", comments_locked: false, deleted_at: "2026-11-20T00:00:00Z" }).map((c) => c.action)).toEqual([
      "restore_deleted",
    ]);
  });
});


const u = (o: Partial<Parameters<typeof userChoices>[0]>) =>
  userChoices({ targetRole: "user", status: "active", self: false, viewerIsAdmin: false, ...o }).map((c) => c.action);

describe("userChoices", () => {
  it("mirrors who may act on whom", () => {
    expect(u({})).toEqual(["suspend_7", "suspend_30", "ban"]);
    expect(u({ status: "suspended" })).toEqual(["unsuspend", "ban"]);
    expect(u({ status: "banned" })).toEqual(["unsuspend"]);
    expect(u({ self: true })).toEqual([]);
    expect(u({ targetRole: "admin", viewerIsAdmin: true })).toEqual([]);
    expect(u({ targetRole: "moderator" })).toEqual([]);
    expect(u({ targetRole: "moderator", viewerIsAdmin: true })).toEqual(["suspend_7", "suspend_30", "ban"]);
  });
});

describe("accountStatus", () => {
  const now = new Date("2026-11-20T12:00:00Z");
  it("reads suspended_until", () => {
    expect(accountStatus(null, now)).toBe("active");
    expect(accountStatus("infinity", now)).toBe("banned");
    expect(accountStatus("2026-11-27T12:00:00Z", now)).toBe("suspended");
    expect(accountStatus("2026-11-01T12:00:00Z", now)).toBe("active");
  });
});
