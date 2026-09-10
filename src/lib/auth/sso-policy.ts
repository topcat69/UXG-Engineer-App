/**
 * Pulled out of getCurrentUser() purely so this decision has direct test
 * coverage — GOOGLE_SSO_ENFORCED is hardcoded false in local dev/CI (see
 * .env.local), so the enforcement branch it guards can never actually run
 * end-to-end in this sandbox no matter what's exercised through the app.
 */
export type AmrMethod = string | { method?: string };

/**
 * true = this session is allowed in under SSO enforcement. Google OAuth
 * always passes; everyone else needs their account's own
 * allow_password_login flag AND a session that was actually established
 * with a password (not just any non-OAuth method — magic link/OTP stays
 * superadmin-only regardless of this flag).
 */
export function isSignInAllowedUnderSso(role: string, allowPasswordLogin: boolean, amr: AmrMethod[]): boolean {
  if (role === "superadmin") return true;
  const methods = amr.map((entry) => (typeof entry === "string" ? entry : entry.method));
  if (methods.includes("oauth")) return true;
  return allowPasswordLogin && methods.includes("password");
}
