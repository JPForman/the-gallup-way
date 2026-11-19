import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type Client = SupabaseClient<Database>;

export type Correction = { id: number; body: string; created_at: string };

/** A story's corrections, oldest first (RLS: visible when the story is). */
export async function listCorrections(client: Client, articleId: string): Promise<Correction[]> {
  const { data, error } = await client
    .from("corrections")
    .select("id, body, created_at")
    .eq("article_id", articleId)
    .order("created_at", { ascending: true })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}
