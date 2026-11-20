import { z } from "zod";

export const DELETE_MODES = ["anonymize", "delete"] as const;
export type DeleteMode = (typeof DELETE_MODES)[number];

export const deleteAccountSchema = z.object({
  mode: z.enum(DELETE_MODES, { error: "Choose what happens to your stories." }),
  password: z.string().min(1, "Enter your password."),
  confirm: z
    .string()
    .trim()
    .refine((v) => v.toUpperCase() === "DELETE", { message: 'Type DELETE to confirm.' }),
});
