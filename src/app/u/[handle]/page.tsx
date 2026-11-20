import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { FollowButton } from "@/components/follow-button";
import { avatarUrl, getProfileByHandle } from "@/lib/db/profiles";
import { SITE_TIMEZONE } from "@/lib/site";
import { createPublicClient } from "@/lib/supabase/public";
import { OwnProfileActions } from "./own-profile-actions";

// Public, cached for 60s and revalidated when the owner saves (see settings/actions.ts).
export const revalidate = 60;

// Build no profiles ahead of time; render each on first visit, then cache (ISR).
export function generateStaticParams(): { handle: string }[] {
  return [];
}

type Props = { params: Promise<{ handle: string }> };

async function load(handle: string) {
  return getProfileByHandle(createPublicClient(), decodeURIComponent(handle));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const profile = await load((await params).handle);
  if (!profile) return { title: "Profile not found" };
  return {
    title: `${profile.display_name} (@${profile.handle})`,
    description: profile.bio ?? `Stories by ${profile.display_name}, a community member.`,
  };
}

function memberSince(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: SITE_TIMEZONE,
  });
}

export default async function ProfilePage({ params }: Props) {
  const profile = await load((await params).handle);
  if (!profile) notFound();

  const isStaff = profile.role === "moderator" || profile.role === "admin";

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 md:py-12">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Avatar name={profile.display_name} src={avatarUrl(profile.avatar_path)} size={96} />
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-3xl font-bold tracking-tight break-words">
            {profile.display_name}
          </h1>
          <p className="mt-1 text-muted-foreground">
            @{profile.handle} · Community member since {memberSince(profile.created_at)}
            {isStaff ? " · Site staff" : ""}
          </p>
        </div>
        <OwnProfileActions profileId={profile.id} />
      </header>

      <div className="mt-4">
        <FollowButton
          profileId={profile.id}
          name={profile.display_name}
          signInNext={`/u/${profile.handle}`}
          showCounts
        />
      </div>

      {profile.bio ? (
        <p className="mt-6 max-w-prose leading-relaxed whitespace-pre-line">{profile.bio}</p>
      ) : null}

      <section aria-labelledby="stories-heading" className="mt-10 border-t border-rule pt-6">
        <h2 id="stories-heading" className="font-serif text-xl font-semibold">
          Stories
        </h2>
        <p className="mt-3 text-muted-foreground">No stories yet.</p>
      </section>
    </main>
  );
}
