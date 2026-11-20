import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const insert = vi.fn(() => Promise.resolve({ error: null as null | { code?: string; message: string } }));
  return {
    session: { value: { user: { id: "me" } } as object | null },
    insert,
    client: {
      auth: { getSession: () => Promise.resolve({ data: { session: mocks.session.value } }) },
      from: () => ({ insert }),
    },
  };
});
vi.mock("@/lib/supabase/client", () => ({ createClient: () => mocks.client }));

import { ReportButton } from "./report-button";

async function openDialog(type: "article" | "comment" | "profile" = "article") {
  const target =
    type === "comment" ? ({ type, id: 7 } as const) : ({ type, id: "a1" } as const);
  render(<ReportButton target={target} signInNext="/a/story" />);
  const noun = { article: "story", comment: "comment", profile: "profile" }[type];
  await userEvent.click(screen.getByRole("button", { name: `Report this ${noun}` }));
  return screen.findByRole("dialog", { name: `Report this ${noun}` });
}

describe("ReportButton", () => {
  beforeEach(() => {
    mocks.session.value = { user: { id: "me" } };
    mocks.insert.mockClear();
    mocks.insert.mockImplementation(() => Promise.resolve({ error: null }));
  });

  it("sends a report with a reason", async () => {
    await openDialog();
    await userEvent.click(await screen.findByRole("radio", { name: /Spam or advertising/ }));
    await userEvent.click(screen.getByRole("button", { name: "Send report" }));
    expect(mocks.insert).toHaveBeenCalledWith({ target_type: "article", article_id: "a1", reason: "spam", details: null });
    expect(await screen.findByRole("status")).toHaveTextContent("A moderator will review this.");
  });

  it("reports comments by id, with details", async () => {
    await openDialog("comment");
    await userEvent.click(await screen.findByRole("radio", { name: /Harassment/ }));
    await userEvent.type(screen.getByLabelText(/Details/), "Name-calling");
    await userEvent.click(screen.getByRole("button", { name: "Send report" }));
    expect(mocks.insert).toHaveBeenCalledWith({
      target_type: "comment",
      comment_id: 7,
      reason: "harassment",
      details: "Name-calling",
    });
  });

  it("checks the form before sending", async () => {
    await openDialog();
    await userEvent.click(await screen.findByRole("button", { name: "Send report" }));
    expect(screen.getByText("Choose a reason.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: /Something else/ }));
    await userEvent.click(screen.getByRole("button", { name: "Send report" }));
    expect(screen.getByText("Tell us what's wrong.")).toBeInTheDocument();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("explains duplicates and limits", async () => {
    mocks.insert.mockImplementation(() => Promise.resolve({ error: { code: "23505", message: "dup" } }));
    await openDialog("profile");
    await userEvent.click(await screen.findByRole("radio", { name: /Spam/ }));
    await userEvent.click(screen.getByRole("button", { name: "Send report" }));
    expect(await screen.findByRole("status")).toHaveTextContent("already reported");
  });

  it("shows the daily limit message", async () => {
    mocks.insert.mockImplementation(() =>
      Promise.resolve({ error: { code: "PT429", message: "You can send up to 30 reports a day. Try again tomorrow." } }),
    );
    await openDialog();
    await userEvent.click(await screen.findByRole("radio", { name: /Spam/ }));
    await userEvent.click(screen.getByRole("button", { name: "Send report" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("30 reports a day");
  });

  it("asks signed-out readers to sign in", async () => {
    mocks.session.value = null;
    await openDialog();
    expect(await screen.findByRole("link", { name: "Sign in to report" })).toHaveAttribute(
      "href",
      "/auth/sign-in?next=%2Fa%2Fstory",
    );
  });
});
