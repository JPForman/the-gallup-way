import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FormMessage } from "@/components/forms/form-message";
import { listMyArticles, STATUS_LABELS } from "@/lib/db/articles";
import { getMyAccount, publishInfo } from "@/lib/db/profiles";
import { createClient } from "@/lib/supabase/server";
import { ArticleForm } from "./article-form";
import { CannotWrite } from "./cannot-write";

export const metadata: Metadata = { title: "Write a story" };

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "America/Denver",
});

export default async function WritePage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string }>;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/auth/sign-in?next=/write");

  const [account, mine, params] = await Promise.all([
    getMyAccount(supabase),
    listMyArticles(supabase, data.user.id),
    searchParams,
  ]);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 md:py-12">
      <h1 className="font-serif text-3xl font-bold tracking-tight">Write a story</h1>
      <p className="mt-2 text-muted-foreground">
        Share what&apos;s happening in Gallup. Stick to what you know firsthand or can source.
      </p>

      {params.deleted ? (
        <div className="mt-6">
          <FormMessage
            status="success"
            message={params.deleted === "story" ? "Story deleted. It's no longer on the site." : "Draft deleted."}
          />
        </div>
      ) : null}

      <div className="mt-8">
        {account?.can_write ? (
          <ArticleForm
            userId={data.user.id}
            status="draft"
            publish={publishInfo(account)}
            initial={{
              articleId: null,
              title: "",
              dek: "",
              category: "",
              contentType: "news",
              body: null,
              sources: [],
              images: [],
            }}
          />
        ) : (
          <CannotWrite account={account} />
        )}
      </div>

      {mine.length ? (
        <section aria-labelledby="mine-heading" className="mt-12 border-t border-border pt-8">
          <h2 id="mine-heading" className="font-serif text-xl font-semibold">
            Your stories
          </h2>
          <ul className="mt-4 divide-y divide-border">
            {mine.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/edit/${a.id}`}
                  className="flex min-h-11 items-center justify-between gap-4 py-3 hover:underline"
                >
                  <span className="font-medium">{a.title || "Untitled draft"}</span>
                  <span className="shrink-0 text-sm text-muted-foreground">
                    {STATUS_LABELS[a.status]} · {dateFmt.format(new Date(a.updated_at))}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
