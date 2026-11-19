"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_CATEGORIES } from "@/lib/site";
import { cn } from "@/lib/utils";

/** Header category strip; marks the category being viewed (incl. its older pages). */
export function CategoryNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Categories" className="border-t border-border">
      <ul className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2 [scrollbar-width:none] md:justify-center">
        {NAV_CATEGORIES.map((c) => {
          const active = pathname === c.href || pathname.startsWith(`${c.href}/`);
          return (
            <li key={c.href} className="shrink-0">
              <Link
                href={c.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-11 items-center border-b-2 px-3 text-sm font-semibold tracking-wide uppercase hover:text-brand",
                  active ? "border-brand text-brand" : "border-transparent",
                )}
              >
                {c.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
