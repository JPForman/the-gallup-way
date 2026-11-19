import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor } from "./cursor";

const c = { publishedAt: "2026-11-19T18:00:00.123456+00:00", id: "abab0000-0000-0000-0000-000000000025" };

describe("feed cursor", () => {
  it("round-trips and is path-safe", () => {
    const raw = encodeCursor(c);
    expect(raw).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeCursor(raw)).toEqual(c);
  });

  it("keeps microseconds exactly", () => {
    expect(decodeCursor(encodeCursor(c))?.publishedAt).toBe("2026-11-19T18:00:00.123456+00:00");
  });

  it("rejects junk", () => {
    expect(decodeCursor("")).toBeNull();
    expect(decodeCursor("not/valid")).toBeNull();
    expect(decodeCursor(Buffer.from("yesterday~abc").toString("base64url"))).toBeNull();
    expect(decodeCursor(Buffer.from(`${c.publishedAt}~${c.id}~x`).toString("base64url"))).toBeNull();
    expect(decodeCursor(Buffer.from(`2026-13-45T99:00:00Z~${c.id}`).toString("base64url"))).toBeNull();
  });
});
