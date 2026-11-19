"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { hasPublicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";
import { SITE_TIMEZONE } from "@/lib/site";

type Notice = { kind: "suspended"; until: string } | { kind: "reaccept" } | null;

/**
 * Site-wide notice for the signed-in user: suspension, or new Terms/Privacy to
 * accept. Client-side so pages stay statically cached.
 */
export function AccountBanner() {
  const pathname = usePathname();
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    if (!hasPublicEnv() || pathname.startsWith("/account/agreements")) {
      setNotice(null);
      return;
    }
    const supabase = createClient();
    let active = true;
    void (async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        if (active) setNotice(null);
        return;
      }
      const { data } = await supabase.rpc("my_account");
      const me = data?.[0];
      if (!active || !me) return;
      if (me.suspended_until) setNotice({ kind: "suspended", until: me.suspended_until });
      else if (me.needs_terms || me.needs_privacy) setNotice({ kind: "reaccept" });
      else setNotice(null);
    })();
    return () => {
      active = false;
    };
  }, [pathname]);

  if (!notice) return null;

  return (
    <div role="status" className="border-b border-border bg-muted">
      <p className="mx-auto max-w-6xl px-4 py-3 text-sm">
        {notice.kind === "suspended" ? (
          <>
            Your account is suspended
            {new Date(notice.until).getFullYear() > 9000
              ? ""
              : ` until ${new Date(notice.until).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                  timeZone: SITE_TIMEZONE,
                })}`}
            . You can still read the board.{" "}
            <Link href="/legal/guidelines" className="font-medium underline underline-offset-4">
              Community Guidelines
            </Link>
          </>
        ) : (
          <>
            We&apos;ve updated our Terms or Privacy Policy.{" "}
            <Link
              href={`/account/agreements?next=${encodeURIComponent(pathname)}`}
              className="font-medium underline underline-offset-4"
            >
              Review and accept
            </Link>{" "}
            to keep posting.
          </>
        )}
      </p>
    </div>
  );
}
