export type ActionChoice = { action: string; label: string; tone?: "danger" | "default" };

/** Which buttons a story in this state offers. */
export function articleChoices(a: { status: string; comments_locked: boolean; deleted_at?: string | null }): ActionChoice[] {
  if (a.deleted_at) return [{ action: "restore_deleted", label: "Undelete story" }];
  const out: ActionChoice[] = [];
  if (a.status === "pending_review") {
    out.push({ action: "approve", label: "Approve and publish" }, { action: "reject", label: "Send back to draft" });
  }
  if (a.status === "published" || a.status === "pending_review") out.push({ action: "hide", label: "Hide story", tone: "danger" });
  if (a.status === "hidden") out.push({ action: "restore", label: "Restore story" });
  if (a.status === "published") {
    out.push(
      a.comments_locked
        ? { action: "unlock_comments", label: "Unlock comments" }
        : { action: "lock_comments", label: "Lock comments" },
    );
  }
  return out;
}

/**
 * Account buttons, mirroring staff_user_action(): nobody acts on themselves
 * or on an admin; only admins act on moderators.
 */
export function userChoices(opts: {
  targetRole: string;
  status: "active" | "suspended" | "banned";
  self: boolean;
  viewerIsAdmin: boolean;
}): ActionChoice[] {
  if (opts.self || opts.targetRole === "admin") return [];
  if (opts.targetRole === "moderator" && !opts.viewerIsAdmin) return [];
  if (opts.status === "active") {
    return [
      { action: "suspend_7", label: "Suspend 7 days", tone: "danger" },
      { action: "suspend_30", label: "Suspend 30 days", tone: "danger" },
      { action: "ban", label: "Ban", tone: "danger" },
    ];
  }
  return [
    { action: "unsuspend", label: opts.status === "banned" ? "Lift ban" : "Lift suspension" },
    ...(opts.status === "suspended" ? [{ action: "ban", label: "Ban", tone: "danger" as const }] : []),
  ];
}
