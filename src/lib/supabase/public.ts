import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/env";
import type { Database } from "./types";

/**
 * Cookie-less client for PUBLIC reads in statically cached (ISR) pages.
 * Always acts as `anon`, so it only sees what RLS shows to everyone, and it
 * doesn't make the page dynamic the way the cookie-based server client does.
 */
export function createPublicClient() {
  const env = getPublicEnv();
  return createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );
}
