"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { hasPublicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";

type AuthState = "unknown" | "signed-out" | "signed-in";

/**
 * Header sign-in / sign-out control. Runs in the browser so pages can stay
 * statically cached (reading cookies on the server would make every page dynamic).
 * Display only: real authorization happens in Postgres.
 */
export function AuthControls() {
  const pathname = usePathname();
  const [state, setState] = useState<AuthState>("unknown");

  useEffect(() => {
    if (!hasPublicEnv()) {
      setState("signed-out");
      return;
    }
    const supabase = createClient();
    let active = true;
    // Re-checked on every navigation: server actions set the session cookie
    // without firing a browser auth event.
    supabase.auth.getSession().then(({ data }) => {
      if (active) setState(data.session ? "signed-in" : "signed-out");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setState(session ? "signed-in" : "signed-out");
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [pathname]);

  if (state === "unknown") {
    // Reserve space to avoid layout shift.
    return <span className="ml-1 inline-block h-11 w-20" aria-hidden />;
  }

  if (state === "signed-in") {
    return (
      <>
        <Button asChild variant="ghost" className="ml-1 hidden h-11 md:inline-flex">
          <Link href="/saved">Saved</Link>
        </Button>
        <Button asChild variant="ghost" className="ml-1 hidden h-11 md:inline-flex">
          <Link href="/me">My profile</Link>
        </Button>
        <form action={signOut} className="ml-1">
          <Button type="submit" variant="outline" className="h-11">
            Sign out
          </Button>
        </form>
      </>
    );
  }

  return (
    <Button asChild variant="outline" className="ml-1 h-11">
      <Link href="/auth/sign-in">Sign in</Link>
    </Button>
  );
}
