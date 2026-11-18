import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AGREEMENTS } from "./agreements";
import { LEGAL_PAGES, type LegalSlug } from "./legal";

/** SHA-256 of an agreement page's canonical JSON (title, summary, sections). */
function agreementTextHash(slug: LegalSlug): string {
  return createHash("sha256").update(JSON.stringify(LEGAL_PAGES[slug])).digest("hex");
}

const migrationsDir = join(process.cwd(), "supabase", "migrations");
const allMigrations = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .map((f) => readFileSync(join(migrationsDir, f), "utf8"))
  .join("\n");

describe("agreement versions", () => {
  for (const [kind, a] of Object.entries(AGREEMENTS)) {
    it(`${kind}: recorded hash matches the current text (bump the version if you changed it)`, () => {
      expect(agreementTextHash(a.slug)).toBe(a.sha256);
    });

    it(`${kind}: version ${a.version} is inserted by a migration`, () => {
      const row = new RegExp(`\\('${kind}',\\s*${a.version},\\s*'${a.sha256}'`);
      expect(allMigrations).toMatch(row);
    });
  }
});
