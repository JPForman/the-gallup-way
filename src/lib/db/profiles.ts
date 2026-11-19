import type { SupabaseClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/types";

type Client = SupabaseClient<Database>;

/** The only profile columns clients may read (see column grants in migrations). */
export const PUBLIC_PROFILE_COLUMNS = "id, handle, display_name, bio, avatar_path, role, created_at";

export type PublicProfile = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "id" | "handle" | "display_name" | "bio" | "avatar_path" | "role" | "created_at"
>;

export async function getProfileByHandle(client: Client, handle: string): Promise<PublicProfile | null> {
  const { data, error } = await client
    .from("profiles")
    .select(PUBLIC_PROFILE_COLUMNS)
    .eq("handle", handle.toLowerCase())
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getProfileById(client: Client, id: string): Promise<PublicProfile | null> {
  const { data, error } = await client
    .from("profiles")
    .select(PUBLIC_PROFILE_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function isHandleTaken(client: Client, handle: string, exceptId?: string): Promise<boolean> {
  let q = client.from("profiles").select("id").eq("handle", handle);
  if (exceptId) q = q.neq("id", exceptId);
  const { data } = await q.maybeSingle();
  return Boolean(data);
}

export type MyAccount = Database["public"]["Functions"]["my_account"]["Returns"][number];

export async function getMyAccount(client: Client): Promise<MyAccount | null> {
  const { data, error } = await client.rpc("my_account");
  if (error) throw error;
  return data[0] ?? null;
}

/** How publishing goes for this writer (mirrors can_publish_directly()). */
export function publishInfo(account: MyAccount | null): { direct: boolean; approvedCount: number } {
  const approvedCount = account?.approved_article_count ?? 0;
  const staff = account?.role === "moderator" || account?.role === "admin";
  return { direct: staff || approvedCount >= 3, approvedCount };
}

export const AVATAR_BUCKET = "avatars";

/** Public CDN URL for an avatar path (bucket is public-read). */
export function avatarUrl(path: string | null): string | null {
  if (!path) return null;
  return `${getPublicEnv().NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${AVATAR_BUCKET}/${path}`;
}

export type WriterResult = Pick<PublicProfile, "id" | "handle" | "display_name" | "bio" | "avatar_path">;

/** Writers whose handle or display name contains the text (search_profiles()). */
export async function searchWriters(client: Client, query: string): Promise<WriterResult[]> {
  const { data, error } = await client.rpc("search_profiles", { p_query: query, p_limit: 20 });
  if (error) throw error;
  return (data ?? []) as WriterResult[];
}
