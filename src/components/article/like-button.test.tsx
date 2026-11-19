import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const engagement = { like_count: 2, liked: false, can_like: true };
  const insert = vi.fn(() => Promise.resolve({ error: null as null | { message: string } }));
  const eq = vi.fn(() => Promise.resolve({ error: null }));
  return {
    engagement,
    session: { value: { user: { id: "u1" } } as object | null },
    insert,
    eq,
    client: {
      auth: { getSession: () => Promise.resolve({ data: { session: mocks.session.value } }) },
      rpc: () => Promise.resolve({ data: [mocks.engagement], error: null }),
      from: () => ({ insert, delete: () => ({ eq }) }),
    },
  };
});
vi.mock("@/lib/supabase/client", () => ({ createClient: () => mocks.client }));

import { LikeButton, likesLabel } from "./like-button";

describe("LikeButton", () => {
  beforeEach(() => {
    Object.assign(mocks.engagement, { like_count: 2, liked: false, can_like: true });
    mocks.session.value = { user: { id: "u1" } };
    mocks.insert.mockClear();
    mocks.insert.mockImplementation(() => Promise.resolve({ error: null }));
    mocks.eq.mockClear();
  });

  it("likes and unlikes, updating the count", async () => {
    render(<LikeButton articleId="a1" slug="s" />);
    const button = await screen.findByRole("button", { name: "Like" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("2 likes")).toBeInTheDocument();

    await userEvent.click(button);
    expect(mocks.insert).toHaveBeenCalledWith({ article_id: "a1" });
    expect(await screen.findByRole("button", { name: "Liked" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("3 likes")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Liked" }));
    expect(mocks.eq).toHaveBeenCalledWith("article_id", "a1");
    expect(await screen.findByText("2 likes")).toBeInTheDocument();
  });

  it("rolls back when saving fails", async () => {
    mocks.insert.mockImplementation(() => Promise.resolve({ error: { message: "nope" } }));
    render(<LikeButton articleId="a1" slug="s" />);
    await userEvent.click(await screen.findByRole("button", { name: "Like" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("couldn't be saved");
    expect(screen.getByText("2 likes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Like" })).toHaveAttribute("aria-pressed", "false");
  });

  it("asks signed-out readers to sign in", async () => {
    mocks.session.value = null;
    render(<LikeButton articleId="a1" slug="my-story" />);
    expect(await screen.findByRole("link", { name: "Sign in to like" })).toHaveAttribute(
      "href",
      "/auth/sign-in?next=/a/my-story",
    );
  });

  it("shows only the count when the reader can't like (e.g. their own story)", async () => {
    mocks.engagement.can_like = false;
    render(<LikeButton articleId="a1" slug="s" />);
    await waitFor(() => expect(screen.getByText("2 likes")).toBeInTheDocument());
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("pluralizes", () => {
    expect(likesLabel(0)).toBe("0 likes");
    expect(likesLabel(1)).toBe("1 like");
  });
});
