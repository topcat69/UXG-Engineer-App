-- Goods-In & Job Sheets, phase 1 (schema + roles). See the "Goods-In & Job
-- Sheets" proposal for the full shape and the decisions this implements.
-- The 'warehouse' role itself is added by the preceding migration — it has
-- to be its own transaction, since Postgres won't allow a freshly added
-- enum value to be referenced (e.g. by the policies below) in the same
-- transaction it was added in.
--
-- One Job Sheet record is worked by three roles at three different times —
-- Office creates it, Warehouse scans hardware onto it, Configurator tests/
-- sets it up/signs it off (Decision 7: no section locks between stages).
-- Warehouse and Configurator are one combined role, not two, matching the
-- existing one-role-per-user model and the expectation that the same
-- person/device often does both jobs back-to-back.

create type job_sheet_status as enum (
  'building','receiving','configuring','ready','assigned','complete'
);
create type stock_item_status as enum (
  'received','configured','installed','returned'
);

-- One record per prepared kit. Mirrors the real paper job sheet's own
-- sections: header/description at creation, software/CMS setup and the
-- closing checklist filled in during configuration, sign-off at the end.
create table job_sheets (
  id uuid primary key default gen_random_uuid(),
  reference text not null,
  site_id uuid references sites(id) not null,
  project_id uuid references projects(id),
  proposed_install_date date,
  job_description text,
  status job_sheet_status not null default 'building',

  -- Software installed / CMS setup.
  cms_name text,
  licence_added boolean,
  teamviewer_added boolean,
  added_to_uxg_account boolean,
  software_notes text,

  -- Closing checklist — each item is a flag, a detail, and whether a photo
  -- was taken, matching the real sheet's Action/Y-N/Detail/Photo-Y-N rows.
  -- "Defects" here is the same flag reused for damage found at any stage
  -- (Decision 3), not a separate goods-in-only field.
  defects boolean, defects_detail text, defects_photo boolean,
  missing_items boolean, missing_items_detail text, missing_items_photo boolean,
  packed_correctly boolean, packed_correctly_detail text, packed_correctly_photo boolean,
  other_parts_used boolean, other_parts_used_detail text, other_parts_used_photo boolean,
  other_issues boolean, other_issues_detail text, other_issues_photo boolean,
  work_area_tidy boolean,

  -- Sign-off — name + timestamp, not a signature (Decision 2).
  signed_off_by uuid references users(id),
  signed_off_at timestamptz,

  linked_job_id uuid references jobs(id),
  created_by uuid references users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create trigger job_sheets_set_updated_at before update on job_sheets
  for each row execute function set_updated_at();
create index on job_sheets (status);
create index on job_sheets (linked_job_id);

-- One row per physical unit. job_sheet_id is deliberately a plain,
-- reassignable foreign key rather than something locked once set — stock
-- sometimes gets pulled for a different, higher-priority job, and that has
-- to be a normal move, not an exception (Decision 7).
create table stock_items (
  id uuid primary key default gen_random_uuid(),
  job_sheet_id uuid references job_sheets(id) on delete cascade not null,
  manufacturer text,
  model text,
  serial_no text,
  firmware_update text,
  image_path text,
  damaged boolean not null default false,
  damage_notes text,
  tested boolean not null default false,
  tested_at timestamptz,
  tested_by uuid references users(id),
  warranty_end date,
  status stock_item_status not null default 'received',
  received_by uuid references users(id),
  received_at timestamptz default now()
);
create index on stock_items (job_sheet_id);

-- The "all players etc tested" grid — a list of test results per job
-- sheet, separate from the per-item tested/date/initial columns above
-- (that's goods-in receipt; this is the fuller functional test run during
-- configuration).
create table job_sheet_tests (
  id uuid primary key default gen_random_uuid(),
  job_sheet_id uuid references job_sheets(id) on delete cascade not null,
  position int not null,
  item_description text,
  ir_bud boolean,
  wifi_cable text,
  tested boolean,
  tested_by uuid references users(id),
  outcome text,
  notes text,
  created_at timestamptz default now()
);
create index on job_sheet_tests (job_sheet_id, position);

alter table job_sheets enable row level security;
alter table stock_items enable row level security;
alter table job_sheet_tests enable row level security;

-- job_sheets — Office/Manager/Warehouse can all see and work a sheet; an
-- engineer only once it's linked to a job they can already see (same
-- transitive idiom as media_assets_select). Only Office/Manager create a
-- sheet or delete one — Warehouse only ever adds to an existing sheet.
-- Assigning to a job (status -> 'assigned', linked_job_id) is a Manager
-- call in the UI, same as jobs_update is left open at the RLS layer and
-- narrowed by the Server Action instead.
create policy job_sheets_select on job_sheets for select using (
  current_user_role() in ('superadmin','manager','warehouse')
  or linked_job_id in (select id from jobs)
);
create policy job_sheets_insert on job_sheets for insert with check (
  current_user_role() in ('superadmin','manager')
);
create policy job_sheets_update on job_sheets for update
  using (current_user_role() in ('superadmin','manager','warehouse'))
  with check (current_user_role() in ('superadmin','manager','warehouse'));
create policy job_sheets_delete on job_sheets for delete using (
  current_user_role() in ('superadmin','manager')
);

-- stock_items / job_sheet_tests — visible and writable wherever the parent
-- job_sheet is, inheriting job_sheets_select transitively.
create policy stock_items_select on stock_items for select using (
  job_sheet_id in (select id from job_sheets)
);
create policy stock_items_insert on stock_items for insert with check (
  current_user_role() in ('superadmin','manager','warehouse')
);
create policy stock_items_update on stock_items for update
  using (job_sheet_id in (select id from job_sheets))
  with check (job_sheet_id in (select id from job_sheets));
create policy stock_items_delete on stock_items for delete using (
  current_user_role() in ('superadmin','manager','warehouse')
);

create policy job_sheet_tests_select on job_sheet_tests for select using (
  job_sheet_id in (select id from job_sheets)
);
create policy job_sheet_tests_insert on job_sheet_tests for insert with check (
  current_user_role() in ('superadmin','manager','warehouse')
);
create policy job_sheet_tests_update on job_sheet_tests for update
  using (job_sheet_id in (select id from job_sheets))
  with check (job_sheet_id in (select id from job_sheets));
create policy job_sheet_tests_delete on job_sheet_tests for delete using (
  current_user_role() in ('superadmin','manager','warehouse')
);
