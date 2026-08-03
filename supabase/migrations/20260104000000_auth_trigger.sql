-- Phase 1: sync auth.users -> public.users on signup, so a magic-link
-- sign-in from someone not in the seed data still gets a row (defaulted to
-- the least-privileged role; an admin promotes them afterwards).
create function handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into users (id, email, name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', new.email), 'engineer')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();
