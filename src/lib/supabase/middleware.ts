import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicEnv, hasPublicEnv } from "@/lib/env";
import type { Database } from "./types";

/**
 * Refreshes the auth session cookie on each matched request so Server
 * Components see a valid session. Route protection is added in Phase 2;
 * real authorization always happens in Postgres via RLS.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Let `pnpm dev` work before Supabase is configured. In production a missing
  // env var must fail loudly, so getPublicEnv() throws there.
  if (process.env.NODE_ENV !== "production" && !hasPublicEnv()) return response;

  const env = getPublicEnv();

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Do not run code between createServerClient and getClaims(): it validates
  // the JWT and triggers the cookie refresh above.
  await supabase.auth.getClaims();

  return response;
}
