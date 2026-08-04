export type ShareLinkRow = { revoked: boolean | null; expires_at: string };

/** Pure so the revoked/expired logic is testable without a database. */
export function isShareLinkValid(link: ShareLinkRow, nowIso: string): boolean {
  if (link.revoked) return false;
  return new Date(link.expires_at).getTime() > new Date(nowIso).getTime();
}
