import Link from "next/link";
import { LEGAL_LINKS, SITE_NAME } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-rule">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <p className="font-serif text-xl font-bold">{SITE_NAME}</p>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">
          A community board for Gallup. Stories are posted by community members and reflect the
          views of their authors. They are not written, edited or independently verified by{" "}
          {SITE_NAME}.
        </p>
        <nav aria-label="Legal" className="mt-6">
          <ul className="flex flex-wrap gap-x-1 gap-y-1">
            {LEGAL_LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="inline-flex min-h-11 items-center px-2 text-sm underline-offset-4 hover:underline"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
