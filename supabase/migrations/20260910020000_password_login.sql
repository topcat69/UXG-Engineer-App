-- Password sign-in for accounts with no Google Workspace access — 3rd
-- party contractors, or a shared warehouse-floor kiosk login, per the
-- "no point buying a Google account just for this" call. Explicit
-- per-account opt-in, default false, so Google SSO enforcement
-- (GOOGLE_SSO_ENFORCED, see getCurrentUser()) isn't silently weakened for
-- every regular member of staff — only an account a superadmin has
-- deliberately flagged can use a password instead of OAuth once SSO is
-- enforced.
alter table users add column allow_password_login boolean not null default false;
