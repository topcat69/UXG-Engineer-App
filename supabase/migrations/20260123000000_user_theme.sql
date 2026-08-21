-- Per-user theme preference (light/dark/blue/forest/slate — the actual set
-- lives in lib/theme/themes.ts, same "plain text, app code is the source of
-- truth" choice already made for jobs.job_type, since the theme list is
-- expected to grow without needing a migration each time).
alter table users add column theme text not null default 'light';

-- users_write (20260103000000_rls.sql) restricts ALL writes on users to
-- superadmin, on purpose — the roster (role/active/etc.) isn't something
-- engineers/managers self-service. A theme preference should be
-- self-service, but RLS can't scope an UPDATE policy to one column, so
-- opening a broad "users can update their own row" policy would let anyone
-- attempt to write their own role/active too (RLS only gates row
-- visibility, not which columns a given UPDATE touches). A SECURITY
-- DEFINER function sidesteps that: it only ever runs this one UPDATE,
-- against exactly the caller's own row, and users can be granted EXECUTE
-- on it without touching the users_write policy at all.
create function set_own_theme(new_theme text) returns void
language sql security definer set search_path = public as $$
  update users set theme = new_theme where id = auth.uid();
$$;
grant execute on function set_own_theme(text) to authenticated;
