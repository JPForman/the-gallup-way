import { Time } from "@/components/admin/time";
import { ACTION_LABELS, type LogEntry } from "@/lib/db/admin";

/** Staff actions, newest first. */
export function ModerationLog({ entries }: { entries: LogEntry[] }) {
  if (!entries.length) {
    return (
      <p className="rounded-md border border-dashed border-border p-6 text-center text-muted-foreground">
        No staff actions yet.
      </p>
    );
  }
  return (
    <ol className="divide-y divide-border rounded-md border border-border">
      {entries.map((e) => (
        <li key={e.id} className="p-4 text-sm">
          <p>
            <span className="font-semibold">{ACTION_LABELS[e.action]}</span>
            {e.article ? <> · {e.article.title}</> : null}
            {e.target ? <> · @{e.target.handle}</> : null}
          </p>
          <p className="mt-1 break-words">{e.reason}</p>
          <p className="mt-1 text-muted-foreground">
            {e.actor ? `@${e.actor.handle}` : "Former staff member"} · <Time iso={e.created_at} />
          </p>
        </li>
      ))}
    </ol>
  );
}
