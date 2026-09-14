-- Asset Register (Phase 1) — see the "Asset Register Scope" design doc for
-- the full rationale behind every decision below; this migration just
-- implements what was confirmed there.
--
-- Deliberately a brand-new table, not the dormant legacy `assets` table
-- left over from the AppSheet import (site/serial/model/asset_type/
-- install_date/warranty_end, an outdated 'admin' role baked into its RLS,
-- and nothing in the live app reads or writes it). That table is left
-- alone here — retiring it is separate cleanup, not part of this feature.
--
-- Goods-in *copies* manufacturer/model/serial/site onto a new row rather
-- than this table being a live join over stock_items/job_sheets, because a
-- job sheet — and everything scanned into it — can be deleted today,
-- cascading through. stock_item_id below is a soft, nullable,
-- set-null-on-delete link kept for traceability only; it's never
-- load-bearing for the register's own data.

create type asset_status as enum ('spare', 'in_use', 'faulty', 'in_repair', 'retired');
create type asset_source as enum ('goods_in', 'import', 'manual');

-- Asset type/category picklist (display, media player, mount, bracket,
-- PSU, cabling, etc.) — its own small catalog rather than folded into
-- Stock Catalog, since it's asset-register-specific, not stock-item
-- manufacturer/model data. Same flat shape as stock_software_providers:
-- open read, superadmin/manager write.
create table asset_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

alter table asset_categories enable row level security;

create policy asset_categories_select on asset_categories for select using (true);
create policy asset_categories_write on asset_categories for insert with check (current_user_role() in ('superadmin', 'manager'));
create policy asset_categories_update on asset_categories for update
  using (current_user_role() in ('superadmin', 'manager'))
  with check (current_user_role() in ('superadmin', 'manager'));
create policy asset_categories_delete on asset_categories for delete using (current_user_role() in ('superadmin', 'manager'));

create table asset_register (
  id uuid primary key default gen_random_uuid(),

  -- Identification / device detail — copied at creation (goods-in/import)
  -- or typed directly (manual); never a hard FK, same "picklist is
  -- convenience, not a relationship" convention as Stock Catalog.
  category_id uuid references asset_categories(id),
  manufacturer text,
  model text,
  serial_number text,

  -- Location. Every site already belongs to one client, so the client
  -- isn't duplicated here — it's read via site_id -> sites.client_id,
  -- same pattern Job Sheets already uses. Null only while status='spare'
  -- (decision 4) — a spare sitting in the warehouse genuinely has no site
  -- yet; every other status must have one.
  site_id uuid references sites(id),

  -- Procurement / financial. purchase_cost is GBP-only (decision 6) — no
  -- currency column. Depreciation is Phase 1's raw inputs only (decision
  -- 5); a computed current-book-value figure is worked out in the UI from
  -- these, never stored, so it can't go stale.
  purchase_date date,
  supplier text,
  po_or_invoice_number text,
  purchase_cost numeric(10, 2),
  depreciation_method text,
  useful_life_years integer,
  residual_value numeric(10, 2),

  -- Warranty & support.
  warranty_start date,
  warranty_end date,
  warranty_provider text,
  support_contract_ref text,
  support_sla text,

  -- Lifecycle & status. install_date is set automatically, not typed in —
  -- see the status-submitted webhook (decision 10). expected_replacement_date/
  -- decommission_date/disposal_date/weee_reference stay manual for Phase 1.
  status asset_status not null default 'spare',
  install_date date,
  expected_replacement_date date,
  decommission_date date,
  disposal_date date,
  weee_reference text,

  -- System & traceability — not requested, needed to make the above work.
  stock_item_id uuid references stock_items(id) on delete set null,
  source asset_source not null,
  needs_review boolean not null default false,

  created_at timestamptz not null default now(),
  created_by uuid references users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references users(id),

  constraint asset_register_site_required_unless_spare check (site_id is not null or status = 'spare')
);

create index on asset_register (site_id);
create index on asset_register (stock_item_id);
create index on asset_register (category_id);
create index on asset_register (needs_review);

create trigger asset_register_set_updated_at before update on asset_register
  for each row execute function set_updated_at();

alter table asset_register enable row level security;

-- select/update/delete: superadmin/manager only (decision 7 — Warehouse
-- gets no visibility into the register at all). insert additionally
-- allows warehouse, since the kiosk's goods-in scan (running as the
-- warehouse session, not the admin client) needs to create a row behind
-- the scenes the same way it already creates a Configuration row today.
create policy asset_register_select on asset_register for select using (
  current_user_role() in ('superadmin', 'manager')
);
create policy asset_register_insert on asset_register for insert with check (
  current_user_role() in ('superadmin', 'manager', 'warehouse')
);
create policy asset_register_update on asset_register for update
  using (current_user_role() in ('superadmin', 'manager'))
  with check (current_user_role() in ('superadmin', 'manager'));
create policy asset_register_delete on asset_register for delete using (
  current_user_role() in ('superadmin', 'manager')
);
