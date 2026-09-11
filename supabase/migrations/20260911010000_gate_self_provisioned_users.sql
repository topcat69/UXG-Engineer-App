-- Google OAuth has no Workspace-domain restriction in this app (no `hd`
-- param on signInWithOAuth, no domain check in /auth/callback) — so
-- anyone with a Google account could complete sign-in, and the trigger
-- below auto-created a real, active 'engineer' account for them. That's
-- a self-service backdoor: access was meant to require an admin
-- pre-creating the account via /office/users (createUser(), which uses
-- the Admin API), not just knowing the login URL.
--
-- Fix: a brand-new auth.users row that this trigger has to fabricate a
-- public.users row for is, by definition, one nobody invited — flip its
-- default to inactive. createUser()'s follow-up update explicitly
-- activates the row it expects the trigger to have just created, so the
-- real invite flow is unaffected. An account that lands here uninvited
-- sits locked out — visible to a superadmin/manager in /office/users,
-- who can review and activate it (or not) same as any other account.
create or replace function handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into users (id, email, name, role, active)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', new.email), 'engineer', false)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Belt and braces: gate this at the RLS layer too, not just the app's
-- own getCurrentUser() check, so an inactive account gets no role-based
-- access even calling Supabase's API directly. NULL role fails every
-- `current_user_role() in (...)`/`= '...'` check that guards real data;
-- an inactive account still keeps ordinary self-access via `id =
-- auth.uid()` clauses (e.g. users_select), which is fine — that's just
-- them seeing their own (inactive) account.
create or replace function current_user_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from users where id = auth.uid() and active;
$$;
