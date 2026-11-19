import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FormMessage } from "@/components/forms/form-message";
import { articleImageUrl, getArticleForEdit, STATUS_LABELS } from "@/lib/db/articles";
import { getMyAccount, publishInfo } from "@/lib/db/profiles";
import type { FormState } from "@/lib/forms/state";
import { createClient } from "@/lib/supabase/server";
import { ArticleForm } from "@/app/write/article-form";
import { CannotWrite } from "@/app/write/cannot-write";
import type { EditNotice } from "@/app/write/actions";
import { DeleteDraftButton } from "./delete-draft-button";
import { WithdrawButton } from "./withdraw-button";

export const metadata: Metadata = { title: "Edit story" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const STATUS_NOTES: Record<string, string> = {
  draft: "Only you can see this draft.",
  pending_review: "A moderator will check it before it appears. You can still make changes.",
  published: "This story is live.",
  hidden: "Moderators hid this story. It can't be edited.",
  archived: "This story is archived and can't be edited.",
};

/** Messages shown after a redirect from the save / publish actions. */
const EDIT_NOTICES: Record<EditNotice, FormState> = {
  saved: { status: "success", message: "Draft saved. You can add photos now." },
  review: {
    status: "success",
    message: "Sent for review. A moderator will check it soon, and it will appear on the site once approved.",
  },
  published: { status: "success", message: "Published. Your story is live." },
  withdrawn: { status: "success", message: "Withdrawn from review. It's a draft again." },
  "publish-failed": {
    status: "error",
    message: "Your draft was saved, but it couldn't be published. Check the story and try again.",
  },
};

function isNotice(v: string | undefined): v is EditNotice {
  return v !== undefined && Object.hasOwn(EDIT_NOTICES, v);
}

export default async function EditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const [{ id }, { notice }] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect(`/auth/sign-in?next=/edit/${id}`);

  const [article, account] = await Promise.all([
    getArticleForEdit(supabase, id, data.user.id),
    getMyAccount(supabase),
  ]);
  if (!article) notFound();

  const status = article.status;
  const editable = status === "draft" || status === "pending_review" || status === "published";
  const canDelete = status === "draft" && !article.submitted_at;
  // Notices that change the page (publish, withdraw) are shown above the form;
  // the "saved" notice is the form's own initial message.
  const topNotice = isNotice(notice) && notice !== "saved" ? EDIT_NOTICES[notice] : null;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 md:py-12">
      <p className="text-sm">
        <Link href="/write" className="underline underline-offset-4">
          Your stories
        </Link>
      </p>
      <h1 className="mt-2 font-serif text-3xl font-bold tracking-tight">
        {status === "draft" ? "Edit draft" : "Edit story"}
      </h1>
      <p className="mt-2 text-muted-foreground">
        <span className="font-semibold text-foreground">{STATUS_LABELS[status]}.</span> {STATUS_NOTES[status]}
        {status === "published" && article.slug ? (
          <>
            {" "}
            <Link href={`/a/${article.slug}`} className="underline underline-offset-4">
              View story
            </Link>
          </>
        ) : null}
      </p>

      {topNotice ? (
        <div className="mt-6">
          <FormMessage status={topNotice.status} message={topNotice.message} />
        </div>
      ) : null}

      {status === "pending_review" && account?.can_write ? (
        <div className="mt-6">
          <WithdrawButton articleId={article.id} />
        </div>
      ) : null}

      <div className="mt-8">
        {!editable ? null : account?.can_write ? (
          <ArticleForm
            key={status}
            userId={data.user.id}
            status={status}
            publish={status === "draft" ? publishInfo(account) : null}
            initialMessage={notice === "saved" ? EDIT_NOTICES.saved : undefined}
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
