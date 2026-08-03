-- Phase 1: table-level grants for the Data API roles.
--
-- This Supabase CLI version no longer auto-exposes newly created tables to
-- `anon`/`authenticated`/`service_role` (see the `auto_expose_new_tables`
-- comment in supabase/config.toml — it's deprecated and being removed
-- entirely, so we grant explicitly rather than lean on it). Without this,
-- every query gets "permission denied for table X" before RLS is even
-- evaluated — GRANTs are the coarse first gate, RLS policies are the
-- fine-grained second one.
--
-- No grants to `anon`: every real table access in this app happens as
-- `authenticated` (after magic-link sign-in) or via the service-role client
-- server-side (share links, seed/migration scripts). There is no
-- legitimate anonymous Data API access pattern here.
grant usage on schema public to authenticated, service_role;
grant all on all tables in schema public to authenticated, service_role;
grant all on all sequences in schema public to authenticated, service_role;
grant execute on all functions in schema public to authenticated, service_role;

alter default privileges in schema public grant all on tables to authenticated, service_role;
alter default privileges in schema public grant all on sequences to authenticated, service_role;
alter default privileges in schema public grant execute on functions to authenticated, service_role;
