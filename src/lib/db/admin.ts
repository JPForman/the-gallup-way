import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type Client = SupabaseClient<Database>;
type Fn<N extends keyof Database["public"]["Functions"]> = Database["public"]["Functions"][N]["Returns"];

export type AdminStats = Fn<"admin_stats">[number];
export type ReportGroup = Fn<"admin_report_queue">[number];
export type NewUser = Fn<"admin_new_users">[number];
export type ModerationKind = Database["public"]["Enums"]["moderation_action_kind"];

export type PendingStory = {
  id: string;
  title: string;
  submitted_at: string | null;
  author: { handle: string; display_name: string } | null;
};

export type LogEntry = {
  id: number;
  action: ModerationKind;
  reason: string;
  created_at: string;
  article_id: string | null;
  comment_id: number | null;
  actor: { handle: string; display_name: string } | null;
  target: { handle: string; display_name: string } | null;
  article: { title: string; slug: string | null } | null;
};

/** Plain-language labels for the log. */
export const ACTION_LABELS: Record<ModerationKind, string> = {
  hide_article: "Hid story",
  restore_article: "Restored story",
  approve_article: "Approved story",
  reject_article: "Sent story back to draft",
  lock_comments: "Locked comments",
  unlock_comments: "Unlocked comments",
  remove_comment: "Removed comment",
  restore_comment: "Restored comment",
  suspend_user: "Suspended user",
  unsuspend_user: "Lifted suspension",
  ban_user: "Banned user",
  change_role: "Changed role",
  dismiss_report: "Dismissed report",
  note: "Note",
};

export const REASON_LABELS: Record<string, string> = {
  defamation: "False claims",
  harassment: "Harassment",
  threat: "Threat",
  copyright: "Copyright",
  spam: "Spam",
  other: "Other",
};

export async function getAdminStats(client: Client): Promise<AdminStats> {
  const { data, error } = await client.rpc("admin_stats");
  if (error) throw error;
  return data[0] ?? { open_reports: 0, high_priority_reports: 0, pending_stories: 0, new_users_7d: 0 };
}

export async function getReportQueue(client: Client): Promise<ReportGroup[]> {
  const { data, error } = await client.rpc("admin_report_queue", { p_limit: 100 });
  if (error) throw error;
  return data;
}

export async function listNewUsers(client: Client): Promise<NewUser[]> {
  const { data, error } = await client.rpc("admin_new_users", { p_limit: 50 });
  if (error) throw error;
  return data;
}

/** Stories waiting for review, oldest first (staff read all articles through RLS). */
export async function listPendingStories(client: Client): Promise<PendingStory[]> {
  const { data, error } = await client
    .from("articles")
    .select("id, title, submitted_at, author:profiles!articles_author_id_fkey (handle, display_name)")
    .eq("status", "pending_review")
    .is("deleted_at", null)
    .order("submitted_at", { ascending: true })
    .limit(100)
    .returns<PendingStory[]>();
  if (error) throw error;
  return data;
}

const LOG_COLUMNS =
  "id, action, reason, created_at, article_id, comment_id, " +
  "actor:profiles!moderation_actions_actor_id_fkey (handle, display_name), " +
  "target:profiles!moderation_actions_profile_id_fkey (handle, display_name), " +
  "article:articles (title, slug)";

/** The moderation log, newest first; optionally for one story. */
export async function listModerationLog(client: Client, opts: { articleId?: string; limit?: number } = {}): Promise<LogEntry[]> {
  let q = client.from("moderation_actions").select(LOG_COLUMNS).order("id", { ascending: false }).limit(opts.limit ?? 100);
  if (opts.articleId) q = q.eq("article_id", opts.articleId);
  const { data, error } = await q.returns<LogEntry[]>();
  if (error) throw error;
  return data;
}

export type AdminArticle = {
  id: string;
  slug: string | null;
  title: string;
  dek: string | null;
  body_json: unknown;
  status: Database["public"]["Enums"]["article_status"];
  category: string | null;
  comments_locked: boolean;
  submitted_at: string | null;
  published_at: string | null;
  deleted_at: string | null;
  author: { id: string; handle: string; display_name: string } | null;
};

export type AdminReport = {
  id: number;
  reason: string;
  details: string | null;
  priority: string;
  status: Database["public"]["Enums"]["report_status"];
  created_at: string;
};

/** A story with its reports, for the staff review page. */
export async function getAdminArticle(
  client: Client,
  id: string,
): Promise<{ article: AdminArticle; reports: AdminReport[] } | null> {
  const { data: article, error } = await client
    .from("articles")
    .select(
      "id, slug, title, dek, body_json, status, category, comments_locked, submitted_at, published_at, deleted_at, " +
        "author:profiles!articles_author_id_fkey (id, handle, display_name)",
    )
    .eq("id", id)
    .maybeSingle<AdminArticle>();
  if (error) throw error;
  if (!article) return null;
  const { data: reports, error: reportError } = await client
    .from("reports")
    .select("id, reason, details, priority, status, created_at")
    .eq("article_id", id)
    .order("created_at", { ascending: false })
    .limit(100)
    .returns<AdminReport[]>();
  if (reportError) throw reportError;
  return { article, reports };
}
