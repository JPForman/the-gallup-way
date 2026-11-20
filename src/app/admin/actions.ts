"use server";

import { revalidatePath } from "next/cache";
import type { PostgrestError } from "@supabase/supabase-js";
import type { FormState } from "@/lib/forms/state";
import { revalidatePublicPages } from "@/lib/revalidate";
import { createClient } from "@/lib/supabase/server";
import { parseModerationForm } from "@/lib/validation/moderation";

const DONE: Record<string, string> = {
  hide: "Story hidden.",
  restore: "Restored.",
  approve: "Story approved and published.",
  reject: "Story sent back to the author as a draft.",
  lock_comments: "Comments locked.",
  unlock_comments: "Comments unlocked.",
  remove: "Comment removed.",
  dismiss: "Report dismissed.",
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
    return {
      status: "error",
      message: reasonIssue?.message ?? "Something about this action isn't valid.",
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
  } else {
    ({ error } = await supabase.rpc("dismiss_report", { p_report_id: input.id, p_reason: input.reason }));
  }

  if (error) {
    return { status: "error", message: errorMessage(error), values: { reason: input.reason } };
  }
  revalidatePath("/admin");
  return { status: "success", message: DONE[input.action] ?? "Done." };
}
