import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The ICS feed is meant for "anyone outside the domain" (per spec) to
 * subscribe to in their own calendar app, so it can't sit behind Supabase
 * auth — but it also can't be an unguessable-only URL (engineer ids aren't
 * secret). An HMAC token over the engineer id, verifiable without a DB
 * round-trip, is the standard shape for this: unforgeable without the
 * server secret, but stateless (no share_links-style row to manage or leak
 * through enumeration).
 */
function secret(): string {
  const value = process.env.ICS_FEED_SECRET;
  if (!value) throw new Error("Missing required environment variable: ICS_FEED_SECRET");
  return value;
}

export function signIcsToken(engineerId: string): string {
  return createHmac("sha256", secret()).update(engineerId).digest("hex");
}

export function verifyIcsToken(engineerId: string, token: string): boolean {
  const expected = Buffer.from(signIcsToken(engineerId), "hex");
  const actual = Buffer.from(token, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function icsFeedUrl(engineerId: string, baseUrl: string): string {
  return `${baseUrl}/api/ics/${engineerId}?token=${signIcsToken(engineerId)}`;
}
