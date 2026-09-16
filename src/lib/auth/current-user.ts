import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSignInAllowedUnderSso } from "@/lib/auth/sso-policy";
import type { Database } from "@/lib/supabase/database.types";

type UserRole = Database["public"]["Enums"]["user_role"];

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  theme: string;
};

/**
 * A deactivated account (users.active = false, set by "delete user" in
 * /office/users) is treated as not signed in at all, even with a valid
 * Supabase Auth session — every caller already redirects to /login on a
 * null return, which is exactly the right outcome here too.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("users")
    .select("id, email, name, role, active, theme, allow_password_login")
    .eq("id", user.id)
    .single();
  // A real query failure (e.g. a column this select expects, like `theme`,
  // missing because a migration hasn't been deployed yet) looks identical
  // to "not signed in" to every caller here — every one of them redirects
  // to /login on a null return, same as an actually-missing row would.
  // That's the right behavior (never show a broken page to a real user),
  // but it made a schema/app mismatch across a whole deploy indistinguishable
  // from "wrong magic link code" with zero clue in the UI why. Logging it
  // loudly server-side is the only place this can surface now.
  if (error) console.error("getCurrentUser: users select failed", error);
  if (!data || !data.active) return null;

  // Magic link is superadmin-only once Google Workspace SSO is live
  // (GOOGLE_SSO_ENFORCED="true" in .env.production — off by default so
  // local dev, CI, and any environment without Google OAuth configured in
  // Supabase keep working on magic link for every role). A non-OAuth
  // session on a non-superadmin account is then treated as not signed in,
  // same as a deactivated account above — unless that specific account has
  // been explicitly opted into password sign-in (users.allow_password_login,
  // set from /office/users), for someone with no Google Workspace seat at
  // all: a 3rd-party contractor, or a shared warehouse-kiosk login. That
  // flag is per-account and defaults false, so it never quietly widens
  // SSO enforcement for regular staff — only an account a superadmin has
  // deliberately flagged gets a second way in.
  //
  // user.app_metadata.provider is NOT this session's actual sign-in
  // method — once an account has ever linked Google, it stays "email"
  // (the account's original/first provider) even on a genuine fresh
  // Google sign-in, locking every non-superadmin out of their own
  // Google-authenticated session. The JWT's `amr` claim (Authentication
  // Method References) is the one field that reflects how *this* session
  // was actually established — `{ method: "oauth" }` for Google, `{
  // method: "otp" }` for magic link, `{ method: "password" }` for a
  // password sign-in — confirmed by decoding a real Google-authenticated
  // session's token during this bug's diagnosis.
  const ssoEnforced = process.env.GOOGLE_SSO_ENFORCED === "true";
  if (ssoEnforced) {
    const { data: claimsData } = await supabase.auth.getClaims();
    const amr = claimsData?.claims.amr ?? [];
    if (!isSignInAllowedUnderSso(data.role, data.allow_password_login, amr)) return null;
  }

  return data;
}

/** Redirects to /login if not signed in, or to / if signed in but not superadmin/manager. */
export async function requireOfficeUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "superadmin" && user.role !== "manager") redirect("/");
  return user;
}

/**
 * Redirects to /login if not signed in, or to / if signed in but not
 * superadmin/warehouse. Manager deliberately isn't included here — per the
 * Goods-In & Job Sheets proposal's "Who does what", Manager works through
 * the office (creates sheets, assigns them to jobs) rather than the
 * warehouse-floor kiosk; superadmin is included as usual for full access.
 */
export async function requireWarehouseUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "superadmin" && user.role !== "warehouse") redirect("/");
  return user;
}

/**
 * Redirects to /login if not signed in, or to / if signed in but not
 * superadmin/finance. Manager isn't included here, same reasoning as
 * requireWarehouseUser above — manager already reaches the Asset
 * Register through the full office UI at /office/asset-register; this
 * gate is for Finance's own stripped-down surface at /finance, which
 * has no access to anything else in the app (see the Asset Register
 * RLS grants in 20260914040000_finance_asset_register_access.sql).
 */
export async function requireFinanceUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "superadmin" && user.role !== "finance") redirect("/");
  return user;
}

/**
 * Redirects to /login if not signed in, or to / if signed in but not
 * superadmin/manager/warehouse/finance — the Damaged Equipment scope's
 * confirmed access decision: those three roles (plus superadmin, as
 * usual) can view/create and set the next step. Deliberately its own
 * top-level route rather than living under /office, since Warehouse and
 * Finance can't reach /office at all — same reasoning as /help.
 */
export async function requireDamagedEquipmentUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!["superadmin", "manager", "warehouse", "finance"].includes(user.role)) redirect("/");
  return user;
}

/** Redirects to /login if not signed in, or to / if signed in but not superadmin — Watchdog's status page (/office/health) is the one surface this gates, per the Watchdog scoping memo's Phase 4. */
export async function requireSuperadminUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "superadmin") redirect("/");
  return user;
}

/**
 * Redirects to /login if not signed in — no role restriction, since Help
 * Guides is reachable from every role's own surface. What each viewer
 * actually sees within it is filtered by help_categories/help_articles'
 * own RLS (role is null, matches the viewer's role, or the viewer is
 * superadmin — see 20260915000000_help_guides.sql), not by this gate.
 */
export async function requireAnyUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Where "back to the app" should point for a given role — used by the Help layout, which has no home of its own. */
export function homeRouteForRole(role: CurrentUser["role"]): string {
  switch (role) {
    case "superadmin":
    case "manager":
      return "/office/dashboard";
    case "warehouse":
      return "/kiosk";
    case "finance":
      return "/finance";
    default:
      return "/my-jobs";
  }
}
