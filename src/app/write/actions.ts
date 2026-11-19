"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { clientIp, hashIp } from "@/lib/auth/ip-hash";
import { ARTICLE_IMAGE_BUCKET, type SaveArticleResult } from "@/lib/db/articles";
import { fieldErrorsOf, type FormState } from "@/lib/forms/state";
import { CATEGORIES } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/lib/supabase/types";
import { parseArticleForm, publishProblems } from "@/lib/validation/article";
import { parseCorrectionForm } from "@/lib/validation/correction";

type Client = SupabaseClient<Database>;

function saveErrorMessage(error: PostgrestError): string {
  switch (error.code) {
    case "PT429":
      return error.message; // user-facing limit message from the DB
    case "42501":
      return "Your account can't write right now. Check the notice at the top of the page.";
    case "P0002":
      return "This story can't be edited anymore.";
    case "23514":
      return "Something in the story isn't valid. Check the fields and try again.";
    default:
      return "We couldn't save your story. Please try again.";
  }
}

/** submit_article() raises user-facing messages for these codes. */
function submitErrorMessage(error: PostgrestError): string {
  if (["PT429", "23514", "42501"].includes(error.code)) return error.message;
  if (error.code === "55000") return "This story has already been submitted.";
  return "We couldn't publish your story. Please try again.";
}

/**
 * Refresh the cached public pages a published story appears on. All category
 * pages are refreshed, since an edit may have moved the story to another one.
 */
function revalidatePublicPages(slug: string | null) {
  revalidatePath("/");
  revalidatePath("/latest");
  for (const c of CATEGORIES) revalidatePath(`/c/${c.slug}`);
  if (slug) revalidatePath(`/a/${slug}`);
}

/** Notices the edit page can show after a redirect (see EDIT_NOTICES). */
export type EditNotice = "saved" | "review" | "published" | "withdrawn" | "publish-failed";

function editUrl(id: string, notice: EditNotice): string {
  return `/edit/${id}?notice=${notice}`;
}

/** Record the Contributor Agreement for this story, then submit it. */
async function publish(
  supabase: Client,
  articleId: string,
): Promise<{ ok: true; status: string; slug: string | null } | { ok: false; message: string }> {
  // version and timestamp are set by the database (current version, now()).
  const { error: acceptError } = await supabase.from("agreement_acceptances").insert({
    kind: "contributor",
    version: 0,
    article_id: articleId,
    ip_hash: hashIp(clientIp(await headers())),
  });
  if (acceptError) return { ok: false, message: "We couldn't record your agreement. Please try again." };

  const { data: status, error } = await supabase.rpc("submit_article", { p_article_id: articleId });
  if (error) return { ok: false, message: submitErrorMessage(error) };

  const { data: row } = await supabase.from("articles").select("slug").eq("id", articleId).maybeSingle();
  return { ok: true, status, slug: row?.slug ?? null };
}

/**
 * Save draft / save changes / publish (intent=publish, drafts only).
 * Creating a story redirects to its edit page, where photos can be added.
 */
export async function saveArticle(_prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return { status: "error", message: "Please sign in again." };

  const wantsPublish = formData.get("intent") === "publish";

  const parsed = parseArticleForm(formData, user.id);
  if (!parsed.ok) {
    return { status: "error", message: "Please fix the highlighted fields.", fieldErrors: parsed.fieldErrors };
  }
  const input = parsed.data;
  const isNew = !input.articleId;

  if (wantsPublish) {
    const problems = publishProblems(input);
    if (formData.get("agreement") !== "on") {
      problems.agreement = ["Agree to the Contributor Agreement to publish."];
    }
    if (Object.keys(problems).length) {
      return { status: "error", message: "Your story isn't ready to publish yet.", fieldErrors: problems };
    }
  } else if (isNew && input.title === "" && input.body.content.length === 0) {
    return { status: "error", message: "Add a headline or some text before saving." };
  }

  const { data, error } = await supabase.rpc("save_article", {
    p_article_id: input.articleId,
    p_title: input.title,
    p_dek: input.dek,
    p_body_json: input.body as unknown as Json,
    p_category: input.category,
    p_content_type: input.contentType,
    p_sources: input.sources as unknown as Json,
    p_images: input.images as unknown as Json,
  });
  if (error) return { status: "error", message: saveErrorMessage(error) };

  const result = data as unknown as SaveArticleResult;

  // Delete photos that were removed from the story (best effort).
  if (result.removed_paths.length) {
    await supabase.storage.from(ARTICLE_IMAGE_BUCKET).remove(result.removed_paths);
  }

  revalidatePath("/write");

  if (wantsPublish && result.status === "draft") {
    const published = await publish(supabase, result.id);
    if (!published.ok) {
      if (isNew) redirect(editUrl(result.id, "publish-failed"));
      return { status: "error", message: `Your changes were saved, but the story wasn't published. ${published.message}` };
    }
    if (published.status === "published") revalidatePublicPages(published.slug);
    redirect(editUrl(result.id, published.status === "published" ? "published" : "review"));
  }

  if (result.status === "published") revalidatePublicPages(result.slug);

  if (isNew) redirect(editUrl(result.id, "saved"));

  return {
    status: "success",
    message: result.status === "draft" ? "Draft saved." : "Changes saved.",
  };
}

/** Pull a story out of the review queue so it can be edited as a draft. */
export async function withdrawArticle(formData: FormData): Promise<void> {
  const id = String(formData.get("articleId") ?? "");
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(`/auth/sign-in?next=/edit/${encodeURIComponent(id)}`);

  const { error } = await supabase.rpc("withdraw_article", { p_article_id: id });
  revalidatePath("/write");
  redirect(error ? `/edit/${id}` : editUrl(id, "withdrawn"));
}

/** Append a correction to the caller's published story (append-only). */
export async function addCorrection(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseCorrectionForm(formData);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the correction.",
      fieldErrors: fieldErrorsOf(parsed.error),
      values: { body: String(formData.get("body") ?? "") },
    };
  }
  const { articleId, body } = parsed.data;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { status: "error", message: "Please sign in again." };

  const { error } = await supabase.from("corrections").insert({ article_id: articleId, body });
  if (error) {
    return {
      status: "error",
      message:
        error.code === "PT429"
          ? error.message
          : "We couldn't add the correction. Only the author of a published story can add one.",
      values: { body },
    };
  }

  const { data: row } = await supabase.from("articles").select("slug").eq("id", articleId).maybeSingle();
  if (row?.slug) revalidatePath(`/a/${row.slug}`);
  revalidatePath(`/edit/${articleId}`);
  return { status: "success", message: "Correction added. It appears on the story with today's date." };
}

/** Permanently delete a never-submitted draft and its photo files. */
export async function deleteDraft(formData: FormData): Promise<void> {
  const id = String(formData.get("articleId") ?? "");
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(`/auth/sign-in?next=/edit/${encodeURIComponent(id)}`);

  const { data: images } = await supabase
    .from("article_images")
    .select("storage_path")
    .eq("article_id", id);

  const { data: deleted } = await supabase
    .from("articles")
    .delete()
    .eq("id", id)
    .eq("author_id", auth.user.id)
    .select("id");

  if (deleted?.length) {
    // Also sweep files uploaded but never saved to the story.
    const folder = `${auth.user.id}/${id}`;
    const { data: files } = await supabase.storage.from(ARTICLE_IMAGE_BUCKET).list(folder);
    const paths = new Set([
      ...(images ?? []).map((i) => i.storage_path),
      ...(files ?? []).map((f) => `${folder}/${f.name}`),
    ]);
    if (paths.size) await supabase.storage.from(ARTICLE_IMAGE_BUCKET).remove([...paths]);
  }

  revalidatePath("/write");
  redirect(deleted?.length ? "/write?deleted=1" : `/edit/${id}`);
}
