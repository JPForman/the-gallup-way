import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { avatarUrl, getProfileById } from "@/lib/db/profiles";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/auth/sign-in?next=/settings");

  const profile = await getProfileById(supabase, data.user.id);
  if (!profile) redirect("/auth/sign-in?next=/settings");

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8 md:py-12">
      <h1 className="font-serif text-3xl font-bold tracking-tight">Settings</h1>
      <p className="mt-2 text-muted-foreground">
        Your public profile:{" "}
        <Link href={`/u/${profile.handle}`} className="font-medium underline underline-offset-4">
          /u/{profile.handle}
        </Link>
      </p>

      <section aria-labelledby="profile-heading" className="mt-8">
        <h2 id="profile-heading" className="font-serif text-xl font-semibold">
          Profile
        </h2>
        <div className="mt-4">
          <ProfileForm
            userId={profile.id}
            initial={{
              displayName: profile.display_name,
              handle: profile.handle,
              bio: profile.bio ?? "",
            }}
            avatarUrl={avatarUrl(profile.avatar_path)}
          />
        </div>
      </section>

      <section aria-labelledby="account-heading" className="mt-12 border-t border-border pt-8">
        <h2 id="account-heading" className="font-serif text-xl font-semibold">
          Account
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Your email is private and never shown on the site. Account deletion is coming soon; until
          then, use the Contact page to ask for your account to be deleted.
        </p>
      </section>
    </main>
  );
}
