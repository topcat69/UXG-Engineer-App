-- Predefined Manufacturer/Model picklists for goods-in on the kiosk (see
-- add-stock-item-form.tsx) -- flat two-level reference data, same shape as
-- kb_manufacturers/kb_model_ranges but global rather than scoped under a KB
-- category, since a Stock Item isn't filed anywhere. stock_items.manufacturer
-- and .model stay the plain text columns they already were -- Warehouse can
-- still type an "Other" value not on either list, so these two tables are
-- only ever a source for the kiosk's dropdown options, never a hard FK on
-- stock_items itself.
--
-- No cascade on manufacturer_id, same convention as everywhere else in this
-- schema (e.g. kb_model_ranges) -- a manufacturer still holding models can't
-- be silently deleted out from under them; remove the models first.

create table stock_manufacturers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz default now()
);

create table stock_models (
  id uuid primary key default gen_random_uuid(),
  manufacturer_id uuid not null references stock_manufacturers(id),
  name text not null,
  created_at timestamptz default now(),
  unique (manufacturer_id, name)
);
create index on stock_models (manufacturer_id);

alter table stock_manufacturers enable row level security;
alter table stock_models enable row level security;

-- Same "shared reference data" shape as kb_categories/kb_manufacturers:
-- readable by anyone signed in (the kiosk needs it), writable only by
-- Office (superadmin/manager) who curate the lists.
create policy stock_manufacturers_select on stock_manufacturers for select using (true);
create policy stock_manufacturers_write on stock_manufacturers for insert with check (current_user_role() in ('superadmin', 'manager'));
create policy stock_manufacturers_update on stock_manufacturers for update
  using (current_user_role() in ('superadmin', 'manager'))
  with check (current_user_role() in ('superadmin', 'manager'));
create policy stock_manufacturers_delete on stock_manufacturers for delete using (current_user_role() in ('superadmin', 'manager'));

create policy stock_models_select on stock_models for select using (true);
create policy stock_models_write on stock_models for insert with check (current_user_role() in ('superadmin', 'manager'));
create policy stock_models_update on stock_models for update
  using (current_user_role() in ('superadmin', 'manager'))
  with check (current_user_role() in ('superadmin', 'manager'));
create policy stock_models_delete on stock_models for delete using (current_user_role() in ('superadmin', 'manager'));
