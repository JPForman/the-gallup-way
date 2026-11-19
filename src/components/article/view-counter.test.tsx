import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn(() => Promise.resolve({ data: true, error: null })) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ rpc }) }));

import { localDay, ViewCounter, viewKey } from "./view-counter";

const ID = "acac0000-0000-0000-0000-0000000000a1";

describe("ViewCounter", () => {
  beforeEach(() => {
    localStorage.clear();
    rpc.mockClear();
  });
  afterEach(() => vi.restoreAllMocks());

  it("records one view per story per day", () => {
    render(<ViewCounter articleId={ID} />);
    expect(rpc).toHaveBeenCalledWith("record_view", { p_article_id: ID });
    expect(localStorage.getItem(viewKey(ID, localDay()))).toBe("1");

    render(<ViewCounter articleId={ID} />);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("skips bots", () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Googlebot/2.1");
    render(<ViewCounter articleId={ID} />);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("uses Gallup's local day", () => {
    // 03:00 UTC on Nov 20 is still Nov 19 in Mountain Time.
    expect(localDay(new Date("2026-11-20T03:00:00Z"))).toBe("2026-11-19");
  });
});
