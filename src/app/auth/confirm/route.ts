import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_TYPES: readonly EmailOtpType[] = ["email", "signup", "recovery", "email_change"];

function isOtpType(t: string | null): t is EmailOtpType {
  return t !== null && (ALLOWED_TYPES as readonly string[]).includes(t);
}

/**
 * Landing page for links in auth emails (see supabase/templates/*.html).
 * Verifies the one-time token, which signs the user in, then redirects.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const next = safeNext(url.searchParams.get("next"));

  if (tokenHash && isOtpType(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      const dest = new URL(next, url.origin);
      if (type === "email" || type === "signup") dest.searchParams.set("welcome", "1");
      return NextResponse.redirect(dest);
    }
  }

  return NextResponse.redirect(new URL("/auth/error", url.origin));
}
