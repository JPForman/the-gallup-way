import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { clientIp, hashIp } = await import("./ip-hash");

describe("clientIp", () => {
  it("takes the first X-Forwarded-For entry", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" }))).toBe("203.0.113.5");
  });
  it("falls back to X-Real-IP, then null", () => {
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.7" }))).toBe("198.51.100.7");
    expect(clientIp(new Headers())).toBeNull();
  });
});

describe("hashIp", () => {
  const salt = "a-test-salt-that-is-long-enough";
  it("returns a stable 64-char hex hash", () => {
    const h = hashIp("203.0.113.5", salt);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(hashIp("203.0.113.5", salt)).toBe(h);
    expect(hashIp("203.0.113.6", salt)).not.toBe(h);
  });
  it("stores nothing without an IP or a real salt", () => {
    expect(hashIp(null, salt)).toBeNull();
    expect(hashIp("203.0.113.5", undefined)).toBeNull();
    expect(hashIp("203.0.113.5", "short")).toBeNull();
  });
});
