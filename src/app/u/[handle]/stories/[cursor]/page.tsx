import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OlderStories } from "@/components/feed/older-stories";
import { listAuthorArticles } from "@/lib/db/articles";
import { getProfileByHandle } from "@/lib/db/profiles";
import { decodeCursor } from "@/lib/feed/cursor";
import { createPublicClient } from "@/lib/supabase/public";

// Older pages of a writer's stories; each cursor is its own cached page (ISR).
export const revalidate = 60;

export function generateStaticParams(): { handle: string; cursor: string }[] {
  return [];
}

type Props = { params: Promise<{ handle: string; cursor: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const profile = await getProfileByHandle(createPublicClient(), decodeURIComponent((await params).handle));
  return {
    title: profile ? `More stories by ${profile.display_name}` : "Profile not found",
    robots: { index: false, follow: true },
  };
}

export default async function AuthorOlderPage({ params }: Props) {
  const { handle, cursor } = await params;
  const before = decodeCursor(cursor);
  if (!before) notFound();
  const client = createPublicClient();
  const profile = await getProfileByHandle(client, decodeURIComponent(handle));
  if (!profile) notFound();
  const { items, next } = await listAuthorArticles(client, profile.id, { before });
  return (
    <OlderStories
      title={`More stories by ${profile.display_name}`}
      items={items}
      next={next}
      basePath={`/u/${profile.handle}/stories`}
      backHref={`/u/${profile.handle}`}
      backLabel={`Back to ${profile.display_name}`}
    />
  );
}
