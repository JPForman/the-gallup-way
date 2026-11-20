export type ActionChoice = { action: string; label: string; tone?: "danger" | "default" };

/** Which buttons a story in this state offers. */
export function articleChoices(a: { status: string; comments_locked: boolean }): ActionChoice[] {
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
