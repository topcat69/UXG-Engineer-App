-- Per-customer SLA lookup lists: Fixture Type (what broke, picked by the
-- office when an SLA is created) and Reason (why, picked by the engineer
-- once diagnosed on site). Strictly scoped to one client each -- per
-- product decision, Currys and Halfords must never see each other's
-- fixture types or reasons, despite some overlap in the reason wording.
-- Feeds job_details.fixture_type_id/reason_id (see next migration).

create table client_sla_fixture_types (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);
create index on client_sla_fixture_types (client_id);

create table client_sla_reasons (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);
create index on client_sla_reasons (client_id);

alter table client_sla_fixture_types enable row level security;
alter table client_sla_reasons enable row level security;

-- Same "shared reference data" shape as clients_select/write
-- (20260116000000_clients.sql): everyone signed in can read, only
-- superadmin/manager can write.
create policy client_sla_fixture_types_select on client_sla_fixture_types for select using (true);
create policy client_sla_fixture_types_write on client_sla_fixture_types for insert with check (current_user_role() in ('superadmin', 'manager'));
create policy client_sla_fixture_types_update on client_sla_fixture_types for update
  using (current_user_role() in ('superadmin', 'manager'))
  with check (current_user_role() in ('superadmin', 'manager'));
create policy client_sla_fixture_types_delete on client_sla_fixture_types for delete using (current_user_role() in ('superadmin', 'manager'));

create policy client_sla_reasons_select on client_sla_reasons for select using (true);
create policy client_sla_reasons_write on client_sla_reasons for insert with check (current_user_role() in ('superadmin', 'manager'));
create policy client_sla_reasons_update on client_sla_reasons for update
  using (current_user_role() in ('superadmin', 'manager'))
  with check (current_user_role() in ('superadmin', 'manager'));
create policy client_sla_reasons_delete on client_sla_reasons for delete using (current_user_role() in ('superadmin', 'manager'));
