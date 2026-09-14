-- Damaged Equipment — see the "Damaged Equipment" scoping notes for the
-- confirmed decisions this implements:
--   1. Next-step dropdown: Pending / Replace / Warranty claim / Repair /
--      Write-off / Other.
--   2. Damaged Stock Alert email subject includes both item name and client.
--   3. Access: superadmin, manager, warehouse, finance can view/create and
--      set the next step; delete stays superadmin/manager only, same
--      convention as Asset Register.
--   4. Retroactive damage (editing a previously-undamaged stock item to
--      damaged) triggers the same copy + email as a goods-in scan that
--      arrives already damaged.
--   5. One photo per damaged item, same convention as stock_items.image_path.
--
-- A damaged_equipment row is a snapshot copy, not a live join over
-- stock_items — same reasoning as asset_register's own stock_item_id
-- comment: a job sheet (and everything scanned into it) can be deleted,
-- and the damage record should survive that. stock_item_id/asset_register_id
-- below are soft, nullable, set-null-on-delete links kept for traceability
-- only, never load-bearing for this table's own data — and both stay null
-- for a manually-logged item (something damaged on the shelf, never
-- through goods-in), which also never touches asset_register: only the
-- goods-in path is asked to double-record into the register.
create type damage_resolution as enum ('pending', 'replace', 'warranty_claim', 'repair', 'write_off', 'other');

create table damaged_equipment (
  id uuid primary key default gen_random_uuid(),

  stock_item_id uuid references stock_items(id) on delete set null,
  asset_register_id uuid references asset_register(id) on delete set null,

  manufacturer text,
  model text,
  description text,
  serial_number text,
  site_id uuid references sites(id),

  damage_notes text,
  next_step damage_resolution not null default 'pending',
  photo_path text,

  created_at timestamptz not null default now(),
  created_by uuid references users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references users(id)
);

create index on damaged_equipment (stock_item_id);
create index on damaged_equipment (site_id);

create trigger damaged_equipment_set_updated_at before update on damaged_equipment
  for each row execute function set_updated_at();

alter table damaged_equipment enable row level security;

create policy damaged_equipment_select on damaged_equipment for select using (
  current_user_role() in ('superadmin', 'manager', 'warehouse', 'finance')
);
create policy damaged_equipment_insert on damaged_equipment for insert with check (
  current_user_role() in ('superadmin', 'manager', 'warehouse', 'finance')
);
create policy damaged_equipment_update on damaged_equipment for update
  using (current_user_role() in ('superadmin', 'manager', 'warehouse', 'finance'))
  with check (current_user_role() in ('superadmin', 'manager', 'warehouse', 'finance'));
create policy damaged_equipment_delete on damaged_equipment for delete using (
  current_user_role() in ('superadmin', 'manager')
);
