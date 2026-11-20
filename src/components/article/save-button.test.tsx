import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const insert = vi.fn(() => Promise.resolve({ error: null as null | { code?: string; message: string } }));
  const deleteEq = vi.fn(() => Promise.resolve({ error: null }));
  return {
    session: { value: { user: { id: "me" } } as object | null },
    saved: { value: false },
    insert,
    deleteEq,
    client: {
      auth: { getSession: () => Promise.resolve({ data: { session: mocks.session.value } }) },
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: () => Promise.resolve({ data: mocks.saved.value ? { article_id: "a1" } : null }) }),
        }),
        insert,
        delete: () => ({ eq: deleteEq }),
      }),
    },
  };
});
vi.mock("@/lib/supabase/client", () => ({ createClient: () => mocks.client }));

import { SaveButton } from "./save-button";

describe("SaveButton", () => {
  beforeEach(() => {
    mocks.session.value = { user: { id: "me" } };
    mocks.saved.value = false;
    mocks.insert.mockClear();
    mocks.insert.mockImplementation(() => Promise.resolve({ error: null }));
    mocks.deleteEq.mockClear();
  });

  it("saves and unsaves a story", async () => {
    render(<SaveButton articleId="a1" slug="s" />);
    const button = await screen.findByRole("button", { name: "Save" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(button);
    expect(mocks.insert).toHaveBeenCalledWith({ article_id: "a1" });
    await userEvent.click(await screen.findByRole("button", { name: "Saved" }));
    expect(mocks.deleteEq).toHaveBeenCalledWith("article_id", "a1");
    expect(await screen.findByRole("button", { name: "Save" })).toHaveAttribute("aria-pressed", "false");
  });

  it("shows stories the reader already saved", async () => {
    mocks.saved.value = true;
    render(<SaveButton articleId="a1" slug="s" />);
    expect(await screen.findByRole("button", { name: "Saved" })).toHaveAttribute("aria-pressed", "true");
  });

  it("rolls back when saving fails", async () => {
    mocks.insert.mockImplementation(() => Promise.resolve({ error: { message: "nope" } }));
    render(<SaveButton articleId="a1" slug="s" />);
    await userEvent.click(await screen.findByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("didn't work");
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("aria-pressed", "false");
  });

  it("asks signed-out readers to sign in", async () => {
    mocks.session.value = null;
    render(<SaveButton articleId="a1" slug="my-story" />);
    expect(await screen.findByRole("link", { name: "Sign in to save" })).toHaveAttribute(
      "href",
      "/auth/sign-in?next=/a/my-story",
    );
  });
});
