import { z } from "zod";
import { isValidHandle, normalizeHandle } from "./handle";

/** Matches the profiles_avatar_path_owner check: <user id>/<name>.webp */
export const AVATAR_FILE_PATTERN = /^[0-9a-f-]{36}\/[a-z0-9-]{1,64}\.webp$/;

export const profileUpdateSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Enter the name to show on your stories.")
    .max(60, "Use 60 characters or fewer."),
  handle: z
    .string()
    .transform(normalizeHandle)
    .refine(isValidHandle, "Use 3–30 lowercase letters, numbers or underscores (some words are reserved)."),
  bio: z
    .string()
    .trim()
    .max(500, "Keep your bio to 500 characters.")
    .transform((v) => (v === "" ? null : v)),
  /** "" = no change, "remove" = clear photo, otherwise a new uploaded path. */
  avatarPath: z
    .string()
    .refine((v) => v === "" || v === "remove" || AVATAR_FILE_PATTERN.test(v), "Invalid photo.")
    .default(""),
});
export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;
