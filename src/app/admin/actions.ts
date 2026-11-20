"use server";

import { revalidatePath } from "next/cache";
import type { PostgrestError } from "@supabase/supabase-js";
import type { FormState } from "@/lib/forms/state";
import { revalidatePublicPages } from "@/lib/revalidate";
import { createClient } from "@/lib/supabase/server";
import { SUSPEND_DAYS, parseModerationForm } from "@/lib/validation/moderation";

const DONE: Record<string, string> = {
  hide: "Story hidden.",
  restore: "Restored.",
  approve: "Story approved and published.",
  reject: "Story sent back to the author as a draft.",
  lock_comments: "Comments locked.",
  unlock_comments: "Comments unlocked.",
  remove: "Comment removed.",
  dismiss: "Report dismissed.",
  suspend_7: "Suspended for 7 days.",
  suspend_30: "Suspended for 30 days.",
  unsuspend: "Suspension lifted.",
  ban: "Account banned.",
  set_role: "Role updated.",
  note: "Note added.",
};

function errorMessage(error: PostgrestError): string {
  // The staff functions raise plain-language messages for these.
  if (["55000", "P0002", "22023"].includes(error.code)) return error.message;
  if (error.code === "42501") return "You don't have permission to do that.";
  return "That didn't work. Please try again.";
}

/**
 * One entry point for staff actions on stories, comments and reports. The
 * database checks the caller is staff, requires the reason, and writes the
 * moderation log in the same transaction.
 */
export async function moderate(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseModerationForm(formData);
  if (!parsed.success) {
    const reasonIssue = parsed.error.issues.find((i) => i.path[0] === "reason");
    const roleIssue = parsed.error.issues.find((i) => i.path[0] === "role");
    return {
      status: "error",
      message: reasonIssue?.message ?? roleIssue?.message ?? "Something about this action isn't valid.",
      fieldErrors: reasonIssue ? { reason: [reasonIssue.message] } : undefined,
      values: { reason: String(formData.get("reason") ?? "") },
    };
  }
  const input = parsed.data;
  const supabase = await createClient();

  let error: PostgrestError | null = null;
  if (input.kind === "article") {
    ({ error } = await supabase.rpc("staff_article_action", {
      p_article_id: input.id,
      p_action: input.action,
      p_reason: input.reason,
      p_report_id: input.reportId,
    }));
    if (!error) {
      const { data } = await supabase.from("articles").select("slug").eq("id", input.id).maybeSingle();
      revalidatePublicPages(data?.slug ?? null);
      revalidatePath(`/admin/articles/${input.id}`);
    }
  } else if (input.kind === "comment") {
    ({ error } = await supabase.rpc("staff_comment_action", {
      p_comment_id: input.id,
      p_action: input.action,
      p_reason: input.reason,
      p_report_id: input.reportId,
    }));
  } else if (input.kind === "report") {
    ({ error } = await supabase.rpc("dismiss_report", { p_report_id: input.id, p_reason: input.reason }));
  } else if (input.kind === "user") {
    const days = input.action === "suspend_7" || input.action === "suspend_30" ? SUSPEND_DAYS[input.action] : null;
    ({ error } = await supabase.rpc("staff_user_action", {
      p_profile_id: input.id,
      p_action: days ? "suspend" : input.action,
      p_reason: input.reason,
      p_until: days ? new Date(Date.now() + days * 86_400_000).toISOString() : undefined,
      p_report_id: input.reportId,
    }));
  } else if (input.kind === "role") {
    ({ error } = await supabase.rpc("set_user_role", { p_profile_id: input.id, p_role: input.role, p_reason: input.reason }));
    // Profiles show "Site staff".
    if (!error) revalidatePath("/u/[handle]", "page");
  } else {
    ({ error } = await supabase.rpc("add_staff_note", { p_reason: input.reason, p_profile_id: input.id }));
  }
  if (!error && (input.kind === "user" || input.kind === "role" || input.kind === "note")) {
    revalidatePath(`/admin/users/${input.id}`);
  }

  if (error) {
    return { status: "error", message: errorMessage(error), values: { reason: input.reason } };
  }
  revalidatePath("/admin");
  return { status: "success", message: DONE[input.action] ?? "Done." };
}
