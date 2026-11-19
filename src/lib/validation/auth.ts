import { z } from "zod";
import { isValidHandle, normalizeHandle } from "./handle";

const email = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.")).pipe(z.string().max(254));

// Supabase/bcrypt ignores bytes past 72.
const newPassword = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(72, "Use 72 characters or fewer.");

const checked = (message: string) => z.literal("on", { error: message });

export const signUpSchema = z.object({
  email,
  password: newPassword,
  displayName: z
    .string()
    .trim()
    .min(1, "Enter the name to show on your stories.")
    .max(60, "Use 60 characters or fewer."),
  handle: z
    .string()
    .transform(normalizeHandle)
    .refine(isValidHandle, "Use 3–30 lowercase letters, numbers or underscores (some words are reserved)."),
  ageConfirmed: checked("You must be 18 or older to join."),
  acceptTerms: checked("You must accept the Terms and Privacy Policy."),
});
export type SignUpInput = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password.").max(72),
  next: z.string().optional(),
});

export const resetRequestSchema = z.object({ email });

export const updatePasswordSchema = z
  .object({ password: newPassword, confirm: z.string() })
  .refine((v) => v.password === v.confirm, {
    message: "Passwords don't match.",
    path: ["confirm"],
  });
