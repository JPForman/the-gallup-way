"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PostgrestError } from "@supabase/supabase-js";
import { ARTICLE_IMAGE_BUCKET, type SaveArticleResult } from "@/lib/db/articles";
import type { FormState } from "@/lib/forms/state";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";
import { parseArticleForm } from "@/lib/validation/article";

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

/**
 * Save draft / save changes. Creating a story redirects to its edit page,
 * where photos can be added.
 */
export async function saveArticle(_prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return { status: "error", message: "Please sign in again." };

  const parsed = parseArticleForm(formData, user.id);
  if (!parsed.ok) {
    return { status: "error", message: "Please fix the highlighted fields.", fieldErrors: parsed.fieldErrors };
  }
  const input = parsed.data;
  const isNew = !input.articleId;

  if (isNew && input.title === "" && input.body.content.length === 0) {
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
  if (result.status === "published" && result.slug) {
    revalidatePath(`/a/${result.slug}`);
    revalidatePath("/");
  }

  if (isNew) redirect(`/edit/${result.id}?saved=1`);

  return {
    status: "success",
    message: result.status === "draft" ? "Draft saved." : "Changes saved.",
  };
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
