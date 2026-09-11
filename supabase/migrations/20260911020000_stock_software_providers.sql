-- Predefined Software Provider picklist in the Stock Catalog — same flat,
-- global reference-data shape as stock_manufacturers (add/edit/delete by
-- Office, readable by anyone signed in), just not cascading into a second
-- level the way Manufacturer -> Model does.

create table stock_software_providers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz default now()
);

alter table stock_software_providers enable row level security;

create policy stock_software_providers_select on stock_software_providers for select using (true);
create policy stock_software_providers_write on stock_software_providers for insert with check (current_user_role() in ('superadmin', 'manager'));
create policy stock_software_providers_update on stock_software_providers for update
  using (current_user_role() in ('superadmin', 'manager'))
  with check (current_user_role() in ('superadmin', 'manager'));
create policy stock_software_providers_delete on stock_software_providers for delete using (current_user_role() in ('superadmin', 'manager'));
