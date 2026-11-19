import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { articleImageUrl, getArticleForEdit, STATUS_LABELS } from "@/lib/db/articles";
import { getMyAccount } from "@/lib/db/profiles";
import { createClient } from "@/lib/supabase/server";
import { ArticleForm } from "@/app/write/article-form";
import { CannotWrite } from "@/app/write/cannot-write";
import { DeleteDraftButton } from "./delete-draft-button";

export const metadata: Metadata = { title: "Edit story" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const STATUS_NOTES: Record<string, string> = {
  draft: "Only you can see this draft.",
  pending_review:
    "Waiting for a moderator. New contributors' first 3 stories are reviewed before they appear.",
  published: "This story is live.",
  hidden: "Moderators hid this story. It can't be edited.",
  archived: "This story is archived and can't be edited.",
};

export default async function EditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const [{ id }, { saved }] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect(`/auth/sign-in?next=/edit/${id}`);

  const [article, account] = await Promise.all([
    getArticleForEdit(supabase, id, data.user.id),
    getMyAccount(supabase),
  ]);
  if (!article) notFound();

  const editable = ["draft", "pending_review", "published"].includes(article.status);
  const canDelete = article.status === "draft" && !article.submitted_at;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 md:py-12">
      <p className="text-sm">
        <Link href="/write" className="underline underline-offset-4">
          Your stories
        </Link>
      </p>
      <h1 className="mt-2 font-serif text-3xl font-bold tracking-tight">
        {article.status === "draft" ? "Edit draft" : "Edit story"}
      </h1>
      <p className="mt-2 text-muted-foreground">
        <span className="font-semibold text-foreground">{STATUS_LABELS[article.status]}.</span>{" "}
        {STATUS_NOTES[article.status]}
        {article.status === "published" && article.slug ? (
          <>
            {" "}
            <Link href={`/a/${article.slug}`} className="underline underline-offset-4">
              View story
            </Link>
          </>
        ) : null}
      </p>

      <div className="mt-8">
        {!editable ? null : account?.can_write ? (
          <ArticleForm
            userId={data.user.id}
            isLive={article.status === "published"}
            initialMessage={saved ? { status: "success", message: "Draft saved. You can add photos now." } : undefined}
            initial={{
              articleId: article.id,
              title: article.title,
              dek: article.dek ?? "",
              category: article.category ?? "",
              contentType: article.content_type,
              body: article.body_json,
              sources: article.sources,
              images: article.images.map((img) => ({ ...img, url: articleImageUrl(img.storage_path) })),
            }}
          />
        ) : (
          <CannotWrite account={account} />
        )}
      </div>

      {canDelete ? (
        <section aria-labelledby="danger-heading" className="mt-12 border-t border-border pt-8">
          <h2 id="danger-heading" className="font-serif text-xl font-semibold">
            Delete draft
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Permanently deletes this draft and its photos. This can&apos;t be undone.
          </p>
          <div className="mt-4">
            <DeleteDraftButton articleId={article.id} />
          </div>
        </section>
      ) : null}
    </main>
  );
}
