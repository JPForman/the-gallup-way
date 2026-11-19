"use server";

import { revalidatePath } from "next/cache";
import { AVATAR_BUCKET, getProfileById, isHandleTaken } from "@/lib/db/profiles";
import { fieldErrorsOf, formValues, type FormState } from "@/lib/forms/state";
import { createClient } from "@/lib/supabase/server";
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
