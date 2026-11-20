import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * The signed-in staff member's Supabase client, or a 404 for everyone else.
 * Call it first in the admin layout AND each admin page: Next renders them
 * in parallel, so the layout's check alone doesn't stop a page's queries.
 * Cached per request. The database enforces the same rule on every call.
 */
export const requireStaff = cache(async () => {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) notFound();
  const { data: staff } = await supabase.rpc("is_staff");
  if (!staff) notFound();
  return supabase;
});
