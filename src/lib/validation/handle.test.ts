import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RESERVED_HANDLES, isValidHandle, normalizeHandle } from "./handle";

/** Reserved list from the newest migration that defines is_valid_handle(). */
function sqlReservedHandles(): Set<string> {
  const dir = join(process.cwd(), "supabase", "migrations");
  const defs = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(join(dir, f), "utf8"))
    .filter((sql) => sql.includes("function public.is_valid_handle"));
  const latest = defs.at(-1);
  if (!latest) throw new Error("is_valid_handle not found in migrations");
  const list = /h not in \(([\s\S]*?)\);/.exec(latest)?.[1] ?? "";
  return new Set([...list.matchAll(/'([^']+)'/g)].map((m) => m[1] ?? ""));
}

describe("handle validation", () => {
  it("matches the database's reserved list exactly", () => {
    expect([...RESERVED_HANDLES].sort()).toEqual([...sqlReservedHandles()].sort());
  });

  it("normalizes input", () => {
    expect(normalizeHandle("  @Gallup_Fan ")).toBe("gallup_fan");
  });

  it.each([
    ["gallup_fan_87", true],
    ["ab", false],
    ["a".repeat(31), false],
    ["has-dash", false],
    ["moderator", false],
  ])("isValidHandle(%s) = %s", (h, ok) => {
    expect(isValidHandle(h)).toBe(ok);
  });
});
