import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/action-form";
import { ModerationLog } from "@/components/admin/moderation-log";
import { Time } from "@/components/admin/time";
import { requireStaff } from "@/lib/admin/auth";
import { userChoices } from "@/lib/admin/choices";
import { REASON_LABELS, accountStatus, getAdminUser, listModerationLog } from "@/lib/db/admin";
import { ROLES } from "@/lib/validation/moderation";

export const metadata = { title: "Account" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const STORY_STATUS: Record<string, string> = {
  draft: "Draft",
  pending_review: "Waiting for review",
  published: "Published",
  hidden: "Hidden by staff",
  archived: "Unpublished",
};

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const supabase = await requireStaff();
  const [found, log, { data: viewer }, { data: viewerIsAdmin }] = await Promise.all([
    getAdminUser(supabase, id),
    listModerationLog(supabase, { profileId: id, limit: 50 }),
    supabase.auth.getUser(),
    supabase.rpc("is_admin"),
  ]);
  if (!found) notFound();
  const { user, stories, reports } = found;
  const status = accountStatus(user.suspended_until);
  const self = viewer.user?.id === user.id;
  const choices = userChoices({ targetRole: user.role, status, self, viewerIsAdmin: !!viewerIsAdmin });
  const openProfileReport = reports.find((r) => r.status === "open");

  const facts = [
    { label: "Role", value: user.role },
    {
      label: "Status",
      value:
        status === "banned"
          ? "Banned"
          : status === "suspended" && user.suspended_until
            ? `Suspended until ${new Date(user.suspended_until).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
            : "Active",
    },
    { label: "Published", value: String(user.published) },
    { label: "Waiting / hidden", value: `${user.pending} / ${user.hidden}` },
    { label: "Approved stories", value: `${user.approved_article_count}${user.approved_article_count >= 3 ? " (publishes directly)" : " of 3"}` },
    { label: "Comments", value: String(user.comments) },
    { label: "Open reports", value: String(user.open_reports) },
  ];

  return (
    <main className="space-y-8">
      <p>
        <Link href="/admin?tab=users" className="text-sm font-medium underline underline-offset-4">
          ← Back to the dashboard
        </Link>
      </p>

      <header>
        <h1 className="font-serif text-3xl font-bold tracking-tight break-words">{user.display_name}</h1>
        <p className="mt-1 text-muted-foreground">
          <Link href={`/u/${user.handle}`} className="underline underline-offset-4">
            @{user.handle}
          </Link>{" "}
          · joined <Time iso={user.created_at} />
        </p>
        {user.bio ? <p className="mt-3 max-w-prose whitespace-pre-line">{user.bio}</p> : null}
      </header>

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {facts.map((f) => (
          <div key={f.label} className="rounded-md border border-border p-3">
            <dt className="text-sm text-muted-foreground">{f.label}</dt>
            <dd className="font-medium capitalize">{f.value}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="account-actions" className="space-y-6 rounded-md border border-border p-4">
        <h2 id="account-actions" className="font-serif text-xl font-semibold">
          Account actions
        </h2>
        {choices.length ? (
          <ActionForm kind="user" id={user.id} reportId={openProfileReport?.id} choices={choices} />
        ) : (
          <p className="text-sm text-muted-foreground">
            {self
              ? "You can't take account actions on yourself."
              : user.role === "admin"
                ? "Admin accounts can't be suspended or banned."
                : "Only admins can take action on another moderator."}
          </p>
        )}

        {viewerIsAdmin && !self ? (
          <div className="border-t border-border pt-6">
            <h3 className="font-semibold">Role</h3>
            <div className="mt-2">
              <ActionForm
                kind="role"
                id={user.id}
                label="Reason for the change"
                choices={[{ action: "set_role", label: "Change role" }]}
              >
                <label className="block text-sm font-semibold" htmlFor="role-select">
                  New role
                </label>
                <select
                  id="role-select"
                  name="role"
                  defaultValue={user.role}
                  className="h-11 w-full rounded-md border border-input bg-background px-3 text-base sm:w-60"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r === "user" ? "Member" : r === "moderator" ? "Moderator" : "Admin"}
                    </option>
                  ))}
                </select>
              </ActionForm>
            </div>
          </div>
        ) : null}

        <div className="border-t border-border pt-6">
          <h3 className="font-semibold">Staff note</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Warnings and context for other staff. Notes are only visible in the admin area.
          </p>
          <div className="mt-2">
            <ActionForm kind="note" id={user.id} label="Note" choices={[{ action: "note", label: "Add note" }]} />
          </div>
        </div>
      </section>

      <section aria-labelledby="profile-reports">
        <h2 id="profile-reports" className="font-serif text-xl font-semibold">
          Reports on this profile
        </h2>
        {reports.length ? (
          <ul className="mt-3 divide-y divide-border rounded-md border border-border">
            {reports.map((r) => (
              <li key={r.id} className="p-4 text-sm">
                <p>
                  <span className="font-semibold">{REASON_LABELS[r.reason] ?? r.reason}</span> · {r.status} ·{" "}
                  <Time iso={r.created_at} />
                </p>
                {r.details ? <p className="mt-1 break-words">{r.details}</p> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-muted-foreground">No reports on the profile itself.</p>
        )}
      </section>

      <section aria-labelledby="user-stories">
        <h2 id="user-stories" className="font-serif text-xl font-semibold">
          Submitted stories
        </h2>
        {stories.length ? (
          <ul className="mt-3 divide-y divide-border rounded-md border border-border">
            {stories.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-medium break-words">{s.title}</p>
                  <p className="text-sm text-muted-foreground">{STORY_STATUS[s.status] ?? s.status}</p>
                </div>
                <Link
                  href={`/admin/articles/${s.id}`}
                  className="inline-flex min-h-11 items-center rounded-md border border-border px-4 font-medium hover:bg-muted"
                >
                  Review
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-muted-foreground">No submitted stories.</p>
        )}
      </section>

      <section aria-labelledby="user-history">
        <h2 id="user-history" className="font-serif text-xl font-semibold">
          Staff history
        </h2>
        <div className="mt-3">
          <ModerationLog entries={log} />
        </div>
      </section>
    </main>
  );
}
