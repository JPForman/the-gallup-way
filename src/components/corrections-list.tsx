import type { Correction } from "@/lib/db/corrections";

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "America/Denver",
});

export function formatCorrectionDate(iso: string): string {
  return dateFmt.format(new Date(iso));
}

/** Dated correction notes, shown on the article and in the editor. Plain text only. */
export function CorrectionsList({ corrections }: { corrections: Correction[] }) {
  if (corrections.length === 0) return null;
  return (
    <ul aria-label="Corrections" className="space-y-3">
      {corrections.map((c) => (
        <li key={c.id} className="rounded-md border border-border bg-muted/50 p-4 text-sm">
          <p className="font-semibold">
            Correction, <time dateTime={c.created_at}>{formatCorrectionDate(c.created_at)}</time>
          </p>
          <p className="mt-1 whitespace-pre-line">{c.body}</p>
        </li>
      ))}
    </ul>
  );
}
