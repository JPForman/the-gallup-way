import { NextResponse, type NextRequest } from "next/server";
import { getProfileById } from "@/lib/db/profiles";
import { createClient } from "@/lib/supabase/server";

/** /me → the signed-in user's profile, or sign-in. */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const origin = request.nextUrl.origin;
  if (!data.user) return NextResponse.redirect(new URL("/auth/sign-in?next=/me", origin));

  const profile = await getProfileById(supabase, data.user.id);
  if (!profile) return NextResponse.redirect(new URL("/settings", origin));
  return NextResponse.redirect(new URL(`/u/${profile.handle}`, origin));
}
