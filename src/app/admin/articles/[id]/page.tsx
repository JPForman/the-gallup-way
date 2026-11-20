import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/action-form";
import { ModerationLog } from "@/components/admin/moderation-log";
import { Time } from "@/components/admin/time";
import { requireStaff } from "@/lib/admin/auth";
import { articleChoices } from "@/lib/admin/choices";
import { REASON_LABELS, getAdminArticle, listModerationLog, listRevisions } from "@/lib/db/admin";
import { RichText } from "@/lib/richtext";

export const metadata = { title: "Review story" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending_review: "Waiting for review",
  published: "Published",
  hidden: "Hidden by staff",
  archived: "Unpublished by the author",
};

export default async function AdminArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const supabase = await requireStaff();
  const found = await getAdminArticle(supabase, id);
  if (!found) notFound();
  const { article, reports } = found;
  const [log, revisions] = await Promise.all([
    listModerationLog(supabase, { articleId: id, limit: 50 }),
    listRevisions(supabase, id),
  ]);
  const openReports = reports.filter((r) => r.status === "open");
  const choices = articleChoices(article);

  return (
    <main className="space-y-8">
      <p>
        <Link href="/admin" className="text-sm font-medium underline underline-offset-4">
          ← Back to the dashboard
        </Link>
      </p>

      <header>
        <p className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          {article.deleted_at ? "Deleted" : (STATUS_LABELS[article.status] ?? article.status)}
          {article.comments_locked ? " · Comments locked" : ""}
        </p>
        <h1 className="mt-1 font-serif text-3xl font-bold tracking-tight break-words">{article.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {article.author ? (
            <>
              by{" "}
              <Link href={`/admin/users/${article.author.id}`} className="underline underline-offset-4">
                {article.author.display_name} (@{article.author.handle})
              </Link>
            </>
          ) : (
            "by a former member"
          )}
          {article.submitted_at ? (
            <>
              {" "}
              · submitted <Time iso={article.submitted_at} />
            </>
          ) : null}
          {article.published_at ? (
            <>
              {" "}
              · published <Time iso={article.published_at} />
            </>
          ) : null}
          {article.slug && article.status === "published" ? (
            <>
              {" "}
              ·{" "}
              <Link href={`/a/${article.slug}`} className="underline underline-offset-4">
                View on site
              </Link>
            </>
          ) : null}
        </p>
      </header>

      {choices.length ? (
        <section aria-labelledby="actions-heading" className="rounded-md border border-border p-4">
          <h2 id="actions-heading" className="font-serif text-xl font-semibold">
            Actions
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {article.deleted_at
              ? "The author deleted this story. Undelete it only if they ask, or if it's needed for a dispute."
              : "Staff hide, restore, approve or reject stories. We never edit what a member wrote."}
          </p>
          <div className="mt-4">
            <ActionForm kind="article" id={article.id} reportId={openReports[0]?.id} choices={choices} />
          </div>
        </section>
      ) : null}

      <section aria-labelledby="reports-heading">
        <h2 id="reports-heading" className="font-serif text-xl font-semibold">
          Reports ({openReports.length} open)
        </h2>
        {reports.length ? (
          <ul className="mt-3 divide-y divide-border rounded-md border border-border">
            {reports.map((r) => (
              <li key={r.id} className="p-4 text-sm">
                <p>
                  <span className="font-semibold">{REASON_LABELS[r.reason] ?? r.reason}</span>
                  {r.priority === "high" ? " · high priority" : ""} · {r.status} · <Time iso={r.created_at} />
                </p>
                {r.details ? <p className="mt-1 break-words">{r.details}</p> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-muted-foreground">No reports.</p>
        )}
      </section>

      <section aria-labelledby="story-heading">
        <h2 id="story-heading" className="font-serif text-xl font-semibold">
          The story
        </h2>
        <div className="mt-3 rounded-md border border-border p-4">
          {article.dek ? <p className="text-lg text-muted-foreground">{article.dek}</p> : null}
          <RichText doc={article.body_json} className="mt-4" />
        </div>
      </section>

      <section aria-labelledby="revisions-heading">
        <h2 id="revisions-heading" className="font-serif text-xl font-semibold">
          Earlier versions ({revisions.length})
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Saved automatically whenever the author edits the story after it was published. Each entry is the version
          that edit replaced.
        </p>
        {revisions.length ? (
          <ol className="mt-3 space-y-3">
            {revisions.map((r) => (
              <li key={r.id} className="rounded-md border border-border">
                <details>
                  <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-x-2 p-4">
                    <span className="font-medium break-words">{r.title}</span>
                    <span className="text-sm text-muted-foreground">
                      replaced <Time iso={r.created_at} />
                      {r.editor ? ` by @${r.editor.handle}` : ""}
                    </span>
                  </summary>
                  <div className="border-t border-border p-4">
                    {r.dek ? <p className="text-muted-foreground">{r.dek}</p> : null}
                    <RichText doc={r.body_json} className="mt-3" />
                  </div>
                </details>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-3 text-muted-foreground">No edits since publishing.</p>
        )}
      </section>

      <section aria-labelledby="history-heading">
        <h2 id="history-heading" className="font-serif text-xl font-semibold">
          Staff history
        </h2>
        <div className="mt-3">
          <ModerationLog entries={log} />
        </div>
      </section>
    </main>
  );
}
