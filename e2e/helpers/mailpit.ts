import { expect } from "@playwright/test";

const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

type Summary = { ID: string; Subject: string; Created: string };

/** Unique address per test run so parallel tests and projects never collide. */
export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`;
}

/**
 * Wait for the newest email to `to` whose subject contains `subject`, and
 * return the /auth/confirm path from its link (host stripped, so the test can
 * open it on Playwright's baseURL instead of the configured site_url).
 */
export async function authLinkFromEmail(to: string, subject: string): Promise<string> {
  let id: string | undefined;
  await expect
    .poll(
      async () => {
        const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
        const body = (await res.json()) as { messages: Summary[] };
        id = body.messages.find((m) => m.Subject.includes(subject))?.ID;
        return id;
      },
      { message: `email "${subject}" to ${to}`, timeout: 15_000 },
    )
    .toBeTruthy();

  const res = await fetch(`${MAILPIT}/api/v1/message/${id}`);
  const msg = (await res.json()) as { HTML: string };
  const href = /href="([^"]*\/auth\/confirm\?[^"]+)"/.exec(msg.HTML)?.[1];
  if (!href) throw new Error("No /auth/confirm link in email");
  const url = new URL(href.replaceAll("&amp;", "&"));
  return `${url.pathname}${url.search}`;
}
