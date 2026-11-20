import type { ProfileStats } from "@/lib/db/profiles";

const num = new Intl.NumberFormat("en-US");

function plural(n: number, one: string, many: string): string {
  return `${num.format(n)} ${n === 1 ? one : many}`;
}

/** "Stories 12 · Likes 340 · …" as a definition list; hidden for people with no stories. */
export function statItems(s: ProfileStats): { label: string; value: string }[] {
  return [
    { label: "Stories", value: plural(s.stories, "story", "stories") },
    { label: "Likes", value: plural(s.likes, "like", "likes") },
    { label: "Comments", value: plural(s.comments, "comment", "comments") },
    { label: "Reads", value: plural(s.views, "read", "reads") },
  ];
}

export function ProfileStatsList({ stats }: { stats: ProfileStats }) {
  if (stats.stories === 0) return null;
  return (
    <dl aria-label="Contributor stats" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {statItems(stats).map(({ label, value }) => {
        const [n, ...word] = value.split(" ");
        return (
          <div key={label} className="rounded-md border border-border px-3 py-2">
            <dt className="sr-only">{label}</dt>
            <dd>
              <span className="block font-serif text-2xl font-semibold">{n}</span>
              <span className="text-sm text-muted-foreground">{word.join(" ")}</span>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
