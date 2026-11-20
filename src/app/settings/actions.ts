"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AVATAR_BUCKET, getProfileById, isHandleTaken } from "@/lib/db/profiles";
import { fieldErrorsOf, formValues, type FormState } from "@/lib/forms/state";
import { revalidatePublicPages } from "@/lib/revalidate";
import { createAdminClient, createPasswordCheckClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { deleteAccountSchema } from "@/lib/validation/account";
import { profileUpdateSchema } from "@/lib/validation/profile";

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, ["displayName", "handle", "bio"]);
  const parsed = profileUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsOf(parsed.error), values };
  }
  const { displayName, handle, bio, avatarPath } = parsed.data;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return { status: "error", message: "Please sign in again.", values };

  const current = await getProfileById(supabase, user.id);
  if (!current) return { status: "error", message: "We couldn't find your profile.", values };

  if (handle !== current.handle && (await isHandleTaken(supabase, handle, user.id))) {
    return { status: "error", fieldErrors: { handle: ["That handle is already taken."] }, values };
  }

  if (avatarPath && avatarPath !== "remove" && !avatarPath.startsWith(`${user.id}/`)) {
    return { status: "error", message: "That photo upload isn't valid. Please try again.", values };
  }

  const nextAvatar =
    avatarPath === "remove" ? null : avatarPath === "" ? current.avatar_path : avatarPath;

  const { data: updated, error } = await supabase
    .from("profiles")
    .update({ display_name: displayName, handle, bio, avatar_path: nextAvatar })
    .eq("id", user.id)
    .select("handle");

  if (error) {
    if (error.code === "23505") {
      return { status: "error", fieldErrors: { handle: ["That handle is already taken."] }, values };
    }
    return { status: "error", message: "We couldn't save your profile. Please try again.", values };
  }
  if (!updated?.length) {
    // RLS hides the row from updates while suspended.
    return { status: "error", message: "Your account is suspended, so your profile can't be changed right now.", values };
  }

  // Clean up the old photo file (best effort).
  if (current.avatar_path && current.avatar_path !== nextAvatar) {
    await supabase.storage.from(AVATAR_BUCKET).remove([current.avatar_path]);
  }

  revalidatePath(`/u/${current.handle}`);
  if (handle !== current.handle) revalidatePath(`/u/${handle}`);

  return {
    status: "success",
    message: "Profile saved.",
    values: { displayName, handle, bio: bio ?? "" },
  };
}

/**
 * Self-service account deletion. The only per-request use of the service-role
 * key: it runs after the caller proves who they are (signed in + password),
 * and only ever deletes the caller's own account.
 *
 *   1. prepare_account_deletion(mode), as the user: removes their stories per
 *      the mode and returns the photo files to delete.
 *   2. Service role: remove those files, then delete the auth user (cascades
 *      to the profile, likes, follows, bookmarks; the rest becomes "Former member").
 */
export async function deleteAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, ["mode", "confirm"]);
  const parsed = deleteAccountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsOf(parsed.error), values };
  }
  const { mode, password } = parsed.data;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user?.email) return { status: "error", message: "Please sign in again.", values };

  const check = await createPasswordCheckClient().auth.signInWithPassword({ email: user.email, password });
  if (check.error || check.data.user?.id !== user.id) {
    return { status: "error", fieldErrors: { password: ["That password isn't right."] }, values };
  }

  const { data: files, error } = await supabase.rpc("prepare_account_deletion", { p_mode: mode });
  if (error) {
    const message =
      error.code === "42501" && error.message.startsWith("Admins")
        ? error.message
        : "We couldn't delete your account. Please try again, or contact us.";
    return { status: "error", message, values };
  }

  const admin = createAdminClient();
  const byBucket = new Map<string, string[]>();
  for (const f of files ?? []) byBucket.set(f.bucket, [...(byBucket.get(f.bucket) ?? []), f.path]);
  // Also sweep the avatar folder (old uploads that were replaced).
  const { data: avatarFiles } = await admin.storage.from(AVATAR_BUCKET).list(user.id);
  for (const f of avatarFiles ?? []) {
    byBucket.set(AVATAR_BUCKET, [...(byBucket.get(AVATAR_BUCKET) ?? []), `${user.id}/${f.name}`]);
  }
  for (const [bucket, paths] of byBucket) {
    if (paths.length) await admin.storage.from(bucket).remove([...new Set(paths)]);
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    return { status: "error", message: "We couldn't finish deleting your account. Please contact us.", values };
  }

  await supabase.auth.signOut();
  revalidatePublicPages(null);
  redirect("/account/deleted");
}
