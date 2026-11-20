import Link from "next/link";
import { ActionForm } from "@/components/admin/action-form";
import { ModerationLog } from "@/components/admin/moderation-log";
import { Time } from "@/components/admin/time";
import {
  REASON_LABELS,
  getAdminStats,
  getReportQueue,
  listModerationLog,
  listNewUsers,
  listPendingStories,
  type ReportGroup,
} from "@/lib/db/admin";
import { requireStaff } from "@/lib/admin/auth";
import { cn } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

const TABS = [
  { key: "reports", label: "Reports" },
  { key: "pending", label: "Pending review" },
  { key: "users", label: "New users" },
  { key: "log", label: "Log" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: rawTab } = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === rawTab) ? (rawTab as Tab) : "reports";
  const supabase = await requireStaff();
  const stats = await getAdminStats(supabase);

  const tiles = [
    { label: "Open reports", value: stats.open_reports, note: `${stats.high_priority_reports} high priority`, tab: "reports" },
    { label: "Pending stories", value: stats.pending_stories, note: "waiting for review", tab: "pending" },
    { label: "New users", value: stats.new_users_7d, note: "in the last 7 days", tab: "users" },
  ];

  return (
    <main>
      <h1 className="font-serif text-3xl font-bold tracking-tight">Admin</h1>

      <dl className="mt-6 grid gap-3 sm:grid-cols-3">
        {tiles.map((t) => (
          <Link
            key={t.label}
            href={`/admin?tab=${t.tab}`}
            className="rounded-md border border-border p-4 hover:bg-muted"
          >
            <dt className="text-sm font-medium text-muted-foreground">{t.label}</dt>
            <dd className="mt-1">
              <span className="block font-serif text-3xl font-semibold">{t.value}</span>
              <span className="text-sm text-muted-foreground">{t.note}</span>
            </dd>
          </Link>
        ))}
      </dl>

      <nav aria-label="Admin sections" className="mt-8 border-b border-border">
        <ul className="-mb-px flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <li key={t.key}>
              <Link
                href={`/admin?tab=${t.key}`}
                aria-current={t.key === tab ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center border-b-2 px-3 font-medium whitespace-nowrap",
                  t.key === tab ? "border-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <section className="mt-6" aria-label={TABS.find((t) => t.key === tab)!.label}>
        {tab === "reports" ? <Reports groups={await getReportQueue(supabase)} /> : null}
        {tab === "pending" ? <Pending stories={await listPendingStories(supabase)} /> : null}
        {tab === "users" ? <Users users={await listNewUsers(supabase)} /> : null}
        {tab === "log" ? <ModerationLog entries={await listModerationLog(supabase)} /> : null}
      </section>
    </main>
  );
}

function Empty({ children }: { children: string }) {
  return <p className="rounded-md border border-dashed border-border p-6 text-center text-muted-foreground">{children}</p>;
}

function groupKey(g: ReportGroup) {
  return `${g.target_type}-${g.article_id ?? g.comment_id ?? g.profile_id}`;
}

function Reports({ groups }: { groups: ReportGroup[] }) {
  if (!groups.length) return <Empty>No open reports.</Empty>;
  return (
    <ul className="space-y-4">
      {groups.map((g) => (
        <li key={groupKey(g)} className="rounded-md border border-border p-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {g.high ? (
              <span className="rounded bg-destructive px-2 py-0.5 font-semibold text-white">High priority</span>
            ) : null}
            <span className="font-semibold capitalize">{g.target_type === "article" ? "Story" : g.target_type}</span>
            <span className="text-muted-foreground">
              · {g.report_count} {g.report_count === 1 ? "report" : "reports"} · first <Time iso={g.first_reported_at} />
              {g.item_state ? ` · ${g.item_state.replace("_", " ")}` : ""}
            </span>
          </div>
          <p className="mt-2 font-medium break-words">
            {g.target_type === "comment" ? `“${g.summary ?? ""}”` : g.summary}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {g.handle ? (
              <>
                by{" "}
                <Link href={`/u/${g.handle}`} className="underline underline-offset-4">
                  @{g.handle}
                </Link>
              </>
            ) : null}
            {g.slug ? (
              <>
                {" "}
                ·{" "}
                <Link href={`/a/${g.slug}${g.target_type === "comment" ? "#comments" : ""}`} className="underline underline-offset-4">
                  View on site
                </Link>
              </>
            ) : null}
          </p>
          <p className="mt-2 text-sm">
            <span className="font-semibold">Reasons:</span> {g.reasons.map((r) => REASON_LABELS[r] ?? r).join(", ")}
          </p>
          {g.details.length ? (
            <ul className="mt-1 list-disc pl-5 text-sm">
              {g.details.map((d, i) => (
                <li key={i} className="break-words">
                  {d}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-4 space-y-4">
            {g.target_type === "article" && g.article_id ? (
              <Link
                href={`/admin/articles/${g.article_id}`}
                className="inline-flex min-h-11 items-center rounded-md border border-border px-4 font-medium hover:bg-muted"
              >
                Review story
              </Link>
            ) : null}
            {g.target_type === "comment" && g.comment_id && g.item_state === "visible" ? (
              <ActionForm
                kind="comment"
                id={g.comment_id}
                reportId={g.report_ids[0]}
                choices={[{ action: "remove", label: "Remove comment", tone: "danger" }]}
              />
            ) : null}
            {g.target_type === "profile" && g.profile_id ? (
              <Link
                href={`/admin/users/${g.profile_id}`}
                className="inline-flex min-h-11 items-center rounded-md border border-border px-4 font-medium hover:bg-muted"
              >
                Review account
              </Link>
            ) : null}
            <details>
              <summary className="cursor-pointer text-sm font-medium">Dismiss {g.report_count === 1 ? "report" : "reports"}</summary>
              <div className="mt-2 space-y-3">
                {g.report_ids.map((id, i) => (
                  <ActionForm
                    key={id}
                    kind="report"
                    id={id}
                    label={g.report_ids.length > 1 ? `Reason for dismissing report ${i + 1}` : "Reason for dismissing"}
                    choices={[{ action: "dismiss", label: "Dismiss" }]}
                  />
                ))}
              </div>
            </details>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Pending({ stories }: { stories: Awaited<ReturnType<typeof listPendingStories>> }) {
  if (!stories.length) return <Empty>No stories are waiting for review.</Empty>;
  return (
    <ul className="divide-y divide-border rounded-md border border-border">
      {stories.map((s) => (
        <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="font-medium break-words">{s.title}</p>
            <p className="text-sm text-muted-foreground">
              {s.author ? `@${s.author.handle}` : "Former member"}
              {s.submitted_at ? (
                <>
                  {" "}
                  · submitted <Time iso={s.submitted_at} />
                </>
              ) : null}
            </p>
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
  );
}

function Users({ users }: { users: Awaited<ReturnType<typeof listNewUsers>> }) {
  if (!users.length) return <Empty>No users yet.</Empty>;
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted">
          <tr>
            <th scope="col" className="p-3">User</th>
            <th scope="col" className="p-3">Joined</th>
            <th scope="col" className="p-3">Role</th>
            <th scope="col" className="p-3">Stories</th>
            <th scope="col" className="p-3">Open reports</th>
            <th scope="col" className="p-3">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {users.map((u) => {
            const suspended = u.suspended_until && new Date(u.suspended_until) > new Date();
            return (
              <tr key={u.id}>
                <td className="p-3">
                  <Link href={`/admin/users/${u.id}`} className="font-medium underline-offset-4 hover:underline">
                    {u.display_name}
                  </Link>
                  <span className="block text-muted-foreground">@{u.handle}</span>
                </td>
                <td className="p-3 whitespace-nowrap">
                  <Time iso={u.created_at} />
                </td>
                <td className="p-3 capitalize">{u.role}</td>
                <td className="p-3">{u.stories}</td>
                <td className="p-3">{u.open_reports}</td>
                <td className="p-3">
                  {u.suspended_until === "infinity" ? "Banned" : suspended ? "Suspended" : "Active"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
