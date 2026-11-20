import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "Top", key: "top" },
  { href: "/latest", label: "Latest", key: "latest" },
  { href: "/following", label: "Following", key: "following" },
] as const;

export type FeedTab = (typeof TABS)[number]["key"];

/** Top / Latest switch. Plain links, so each feed is its own cached page. */
export function FeedTabs({ current }: { current: FeedTab }) {
  return (
    <nav aria-label="Feeds" className="mb-6 border-b border-rule">
      <ul className="flex gap-1">
        {TABS.map((t) => (
          <li key={t.key}>
            <Link
              href={t.href}
              aria-current={t.key === current ? "page" : undefined}
              className={cn(
                "-mb-px inline-flex min-h-11 items-center border-b-2 px-4 text-sm font-semibold tracking-wide uppercase",
                t.key === current
                  ? "border-brand text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
