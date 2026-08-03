import type { Page } from "@playwright/test";

const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

/**
 * Drives the real magic-link flow: submits the login form, fetches the
 * resulting email from the local Mailpit inbox, and follows its
 * confirmation link — the same path a real user takes, no session
 * shortcuts. Requires local Supabase to be running (`pnpm db:start`).
 */
export async function loginAs(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.fill("#email", email);
  await page.click('button[type="submit"]');
  await page.waitForSelector("text=Check");

  const res = await fetch(`${MAILPIT_URL}/api/v1/messages?limit=10`);
  const { messages } = (await res.json()) as { messages: { ID: string; To: { Address: string }[] }[] };
  const msg = messages.find((m) => m.To.some((t) => t.Address === email));
  if (!msg) throw new Error(`No email found for ${email} in Mailpit`);

  const detailRes = await fetch(`${MAILPIT_URL}/api/v1/message/${msg.ID}`);
  const detail = (await detailRes.json()) as { HTML?: string; Text?: string };
  const body = detail.HTML || detail.Text || "";
  const match = body.match(/https?:\/\/[^\s"'<>]*\/auth\/v1\/verify\?[^\s"'<>]*/);
  if (!match) throw new Error(`No confirmation link found in email body for ${email}`);

  await page.goto(match[0].replace(/&amp;/g, "&"));
  await page.waitForURL(/\/(office|my-jobs)/, { timeout: 10_000 });
}
