-- Clients: a central, reusable repository of the businesses this app does
-- work for (e.g. "FootAsylum"), independent of Project. A Project is a
-- time/organisational container ("Jobs 2026") that can hold jobs for many
-- different clients at once -- it's not scoped to one client, so it never
-- gets a client_id. What a job is actually *for* flows through its site
-- instead: sites are the real-world locations work happens at (a client's
-- individual store, or the client itself when there's no separate site --
-- e.g. a client with a single location just gets one site named after the
-- client). Every site belongs to exactly one client, so a job's client is
-- always derivable via job -> site -> client, with reporting able to
-- answer "which FootAsylum store did we visit" without a redundant
-- client_id directly on jobs that could drift out of sync with the site.
create table clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,
  contact_email text,
  contact_phone text,
  notes text,
  created_at timestamptz default now()
);

alter table clients enable row level security;

-- Mirrors the projects/sites "shared reference data" policy shape from
-- 20260103000000_rls.sql: everyone signed in can read, only
-- superadmin/manager can write. ('superadmin' here, not 'admin' -- the
-- enum value was renamed in place by 20260115000000, so every policy
-- written after that point uses the current label directly.)
create policy clients_select on clients for select using (true);
create policy clients_write on clients for insert with check (current_user_role() in ('superadmin', 'manager'));
create policy clients_update on clients for update
  using (current_user_role() in ('superadmin', 'manager'))
  with check (current_user_role() in ('superadmin', 'manager'));
create policy clients_delete on clients for delete using (current_user_role() in ('superadmin', 'manager'));

-- sites.organisation was the ad-hoc, free-text predecessor of a real
-- Client relationship -- superseded by client_id now that Clients exist as
-- a proper entity, so it goes rather than keeping two parallel, driftable
-- ways to say the same thing.
--
-- A placeholder client to backfill onto any site rows that already exist
-- in this database before client_id becomes required -- deliberately not
-- assuming this is a fresh, empty database. Harmless if it turns out
-- nothing needed it: just an unused row, safe to rename or delete by hand.
insert into clients (name, notes)
values ('Unknown', 'Placeholder backfilled onto any sites that existed before client_id became required. Safe to rename or reassign.');

alter table sites add column client_id uuid references clients(id);
update sites set client_id = (select id from clients where name = 'Unknown') where client_id is null;
alter table sites alter column client_id set not null;
alter table sites drop column organisation;

-- projects.client_name predates Clients existing at all, and doesn't
-- generalise to "a project can span many clients" -- there's no longer a
-- single client to name on a project, so the field is just dropped rather
-- than repurposed.
alter table projects drop column client_name;
