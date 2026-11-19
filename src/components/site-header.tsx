import Link from "next/link";
import { PenLine, Search } from "lucide-react";
import { AuthControls } from "@/components/auth-controls";
import { CategoryNav } from "@/components/category-nav";
import { DateLine } from "@/components/date-line";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

export function SiteHeader() {
  return (
    <header className="border-b border-rule">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex items-center justify-between gap-2 pt-3">
          <DateLine />
          <div className="flex items-center">
            <Button asChild variant="ghost" size="icon" className="hidden size-11 md:inline-flex">
              <Link href="/search" aria-label="Search">
                <Search className="size-5" aria-hidden />
              </Link>
            </Button>
            <ThemeToggle />
            <AuthControls />
            <Button
              asChild
              className="ml-2 hidden h-11 bg-brand text-brand-foreground hover:bg-brand/90 md:inline-flex"
            >
              <Link href="/write">
                <PenLine aria-hidden />
                Write a story
              </Link>
            </Button>
          </div>
        </div>

        <div className="py-3 text-center md:py-5">
          <Link
            href="/"
            className="font-serif text-4xl leading-none font-bold tracking-tight md:text-6xl"
          >
            {SITE_NAME}
          </Link>
          <p className="mt-2 text-sm text-muted-foreground italic">{SITE_TAGLINE}</p>
        </div>
      </div>

      <CategoryNav />
    </header>
  );
}
