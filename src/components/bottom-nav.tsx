"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bookmark, Home, PenLine, Search, User, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Item = { href: string; label: string; icon: LucideIcon; primary?: boolean };

export const BOTTOM_NAV_ITEMS: Item[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/search", label: "Search", icon: Search },
  { href: "/write", label: "Write", icon: PenLine, primary: true },
  { href: "/saved", label: "Saved", icon: Bookmark },
  { href: "/me", label: "Profile", icon: User },
];

export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Mobile-only bottom navigation. Hidden at md and up (header has the links there). */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-5">
        {BOTTOM_NAV_ITEMS.map(({ href, label, icon: Icon, primary }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {primary ? (
                  <span className="flex size-10 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-sm">
                    <Icon className="size-5" aria-hidden />
                  </span>
                ) : (
                  <Icon className="size-5" aria-hidden />
                )}
                <span className={primary ? "sr-only" : undefined}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
