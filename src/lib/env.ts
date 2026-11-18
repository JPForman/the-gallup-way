import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  /** Publishable key (sb_publishable_…) or legacy anon key. Safe in the browser; RLS protects data. */
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

let cached: PublicEnv | undefined;

function readPublicEnv() {
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}

/** True when the Supabase public env vars are present and valid. */
export function hasPublicEnv(): boolean {
  return publicEnvSchema.safeParse(readPublicEnv()).success;
}

/**
 * Validated public env. Parsed lazily so static pages build without Supabase
 * configured. Each variable is referenced literally so Next.js can inline it
 * into the browser bundle.
 */
export function getPublicEnv(): PublicEnv {
  cached ??= publicEnvSchema.parse(readPublicEnv());
  return cached;
}
