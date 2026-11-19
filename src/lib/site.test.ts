import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CATEGORIES } from "./site";

const migration = readFileSync(
  join(process.cwd(), "supabase", "migrations", "20261119010000_articles.sql"),
  "utf8",
);

describe("CATEGORIES", () => {
  it("matches the categories seeded by the articles migration, in order", () => {
    const seed = migration.slice(migration.indexOf("insert into public.categories"));
    const rows = [...seed.matchAll(/\('([a-z-]+)', '([^']+)', (\d+)\)/g)].map((m) => ({
      slug: m[1],
      name: m[2],
      sort: Number(m[3]),
    }));
    expect(rows.map(({ slug, name }) => ({ slug, name }))).toEqual(CATEGORIES.map((c) => ({ ...c })));
    expect(rows.map((r) => r.sort)).toEqual(CATEGORIES.map((_, i) => i + 1));
  });
});
