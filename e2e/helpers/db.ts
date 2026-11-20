import { AGREEMENTS } from "../../src/content/agreements";
import postgres from "postgres";

/**
 * Direct access to the LOCAL Supabase Postgres for test setup only
 * (e.g. simulating a suspension). Never point this at a real database.
 */
const url = process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
if (!/@(127\.0\.0\.1|localhost):54322\//.test(url)) {
  throw new Error("e2e db helper only runs against the local Supabase database");
}

export const sql = postgres(url, { max: 2, idle_timeout: 5 });

export async function userIdByEmail(email: string): Promise<string> {
  const rows = await sql<{ id: string }[]>`select id from auth.users where email = ${email}`;
  const id = rows[0]?.id;
  if (!id) throw new Error(`No user ${email}`);
  return id;
}

/** Sign-up metadata for fixture users: 18+ and the current Terms and Privacy Policy. */
export const ACCEPTED_SIGNUP = {
  age_confirmed: true,
  accepted_terms_version: AGREEMENTS.terms.version,
  accepted_privacy_version: AGREEMENTS.privacy.version,
};
