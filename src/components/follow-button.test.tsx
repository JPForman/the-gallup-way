import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const context = { followers: 4, following: 2, is_following: false, can_follow: true };
  const insert = vi.fn(() => Promise.resolve({ error: null as null | { code?: string; message: string } }));
  const eq = vi.fn(() => Promise.resolve({ error: null }));
  return {
    context,
    session: { value: { user: { id: "me" } } as object | null },
    insert,
    eq,
    client: {
      auth: { getSession: () => Promise.resolve({ data: { session: mocks.session.value } }) },
      rpc: () => Promise.resolve({ data: [mocks.context], error: null }),
      from: () => ({ insert, delete: () => ({ eq }) }),
    },
  };
});
vi.mock("@/lib/supabase/client", () => ({ createClient: () => mocks.client }));
vi.mock("@/lib/env", () => ({ hasPublicEnv: () => true }));

import { FollowButton, followerLabel } from "./follow-button";

describe("FollowButton", () => {
  beforeEach(() => {
    Object.assign(mocks.context, { followers: 4, following: 2, is_following: false, can_follow: true });
    mocks.session.value = { user: { id: "me" } };
    mocks.insert.mockClear();
    mocks.insert.mockImplementation(() => Promise.resolve({ error: null }));
    mocks.eq.mockClear();
  });

  it("follows and unfollows, updating the follower count", async () => {
    render(<FollowButton profileId="w1" name="Rosa" signInNext="/u/rosa" showCounts />);
    const button = await screen.findByRole("button", { name: "Follow Rosa" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("4 followers · 2 following")).toBeInTheDocument();

    await userEvent.click(button);
    expect(mocks.insert).toHaveBeenCalledWith({ followee_id: "w1" });
    expect(await screen.findByRole("button", { name: "Following Rosa" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("5 followers · 2 following")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Following Rosa" }));
    expect(mocks.eq).toHaveBeenCalledWith("followee_id", "w1");
    expect(await screen.findByText("4 followers · 2 following")).toBeInTheDocument();
  });

  it("rolls back and explains the daily limit", async () => {
    mocks.insert.mockImplementation(() =>
      Promise.resolve({ error: { code: "PT429", message: "You can follow up to 100 people a day. Try again tomorrow." } }),
    );
    render(<FollowButton profileId="w1" name="Rosa" signInNext="/u/rosa" showCounts />);
    await userEvent.click(await screen.findByRole("button", { name: "Follow Rosa" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("100 people a day");
    expect(screen.getByRole("button", { name: "Follow Rosa" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("4 followers · 2 following")).toBeInTheDocument();
  });

  it("asks signed-out readers to sign in", async () => {
    mocks.session.value = null;
    mocks.context.can_follow = false;
    render(<FollowButton profileId="w1" name="Rosa" signInNext="/a/some-story" />);
    expect(await screen.findByRole("link", { name: "Sign in to follow" })).toHaveAttribute(
      "href",
      "/auth/sign-in?next=%2Fa%2Fsome-story",
    );
  });

  it("shows no button on your own profile, only counts", async () => {
    mocks.session.value = { user: { id: "w1" } };
    mocks.context.can_follow = false;
    render(<FollowButton profileId="w1" name="Rosa" signInNext="/u/rosa" showCounts />);
    await waitFor(() => expect(screen.getByText("4 followers · 2 following")).toBeInTheDocument());
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("lets a suspended reader unfollow but not follow", async () => {
    mocks.context.can_follow = false;
    const { unmount } = render(<FollowButton profileId="w1" name="Rosa" signInNext="/u/rosa" />);
    await waitFor(() => expect(screen.queryByRole("button")).not.toBeInTheDocument());
    unmount();
    mocks.context.is_following = true;
    render(<FollowButton profileId="w1" name="Rosa" signInNext="/u/rosa" />);
    expect(await screen.findByRole("button", { name: "Following Rosa" })).toBeInTheDocument();
  });

  it("pluralizes", () => {
    expect(followerLabel(0)).toBe("0 followers");
    expect(followerLabel(1)).toBe("1 follower");
  });
});
