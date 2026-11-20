import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { avatarUrl, getProfileById } from "@/lib/db/profiles";
import { createClient } from "@/lib/supabase/server";
import { DeleteAccountForm } from "./delete-account-form";
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
      {profile.role === "moderator" || profile.role === "admin" ? (
        <p className="mt-4 rounded-md border border-border bg-muted p-3 text-sm">
          You&apos;re site staff.{" "}
          <Link href="/admin" className="font-medium underline underline-offset-4">
            Open the admin dashboard
          </Link>
        </p>
      ) : null}
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
        <p className="mt-2 text-sm text-muted-foreground">Your email is private and never shown on the site.</p>
        <h3 className="mt-6 font-semibold">Delete your account</h3>
        {profile.role === "admin" ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Admins can&apos;t delete their own account, so the site always keeps an admin. Ask another admin to change
            your role first.
          </p>
        ) : (
          <div className="mt-3">
            <DeleteAccountForm />
          </div>
        )}
      </section>
    </main>
  );
}
