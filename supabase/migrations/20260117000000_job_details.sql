-- Four job types (install, sla, maintenance, delivery) replace the single
-- generic "install" form with fields specific to each, per the "Field
-- Operations Platform Replacement" spec. survey keeps its own existing
-- survey_forms table unchanged. install_forms is superseded by this new
-- job_details table (broader than just AV installs) but not dropped here
-- -- see the app-code migration commit for why the table itself stays.
--
-- Deliberately a small table: most of the spec's sections are already
-- fully covered by existing infrastructure and don't need new columns --
-- "Commence job from beginning of journey / at customer site (start
-- time)" is already the travelling/on_site status_events rows (occurred_at
-- per status change); "Customer Sign Off (date stamped)" is already the
-- signatures table (signed_at); "Photos of..." are already media_assets
-- with new slot values (see lib/forms/job-form.ts, no schema change);
-- "Log any issues... creates an issue in the issue log and Monday.com" is
-- already the issues table + its existing webhook. What's actually new is
-- listed below.
create table job_details (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references jobs(id) on delete cascade unique,

  -- AV fields, carried over from install_forms -- install/sla/maintenance
  -- only (not delivery, which has no equipment-condition checks).
  player_serial text,
  screen_serial text,
  mount_type text,
  power_source text,
  network_type text,
  wifi_signal text,
  player_boot_test pass_fail,
  content_displaying pass_fail,

  -- "Info on system": reference material the office prepares at job
  -- creation, shown read-only to the engineer -- not something filled in
  -- on a phone mid-visit.
  rams_storage_path text,               -- all four types
  site_plan_storage_path text,          -- install only
  sla_requirement_detail text,          -- sla + maintenance only ("Details of SLA requirement")

  -- "Job" section fields with no existing home -- all four types.
  parking_notified boolean default false,
  reported_to_site_manager boolean default false,

  -- "Revisit Required": install + sla only, per spec (maintenance and
  -- delivery don't have this section). Yes answers go through the same
  -- createRevisitJob helper already used for auto-revisits from fail
  -- answers (see Phase 5) -- this is just an explicit engineer-driven
  -- trigger for the same mechanism, not a separate one.
  revisit_required boolean,

  -- "Issues" section: install/sla/maintenance only (delivery has none).
  -- Same shape as install_forms' issues_found/issue_detail so the
  -- existing auto-issue-on-fail logic (detectAutoIssues) carries over
  -- unchanged, just parameterised by job type instead of install-only.
  issues_found boolean default false,
  issue_detail text,

  engineer_notes text,
  submitted_at timestamptz,
  created_at timestamptz default now()
);

-- Install-only, office-entered planning list ("Equipment list (including
-- model & serial nos)") -- a repeating structure doesn't fit a flat
-- nullable-column row the way job_details' other fields do, hence its own
-- table rather than e.g. a fixed equipment_1/equipment_2 pair of columns.
create table job_equipment (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references jobs(id) on delete cascade,
  model text not null,
  serial text,
  position int not null default 0,
  created_at timestamptz default now()
);

alter table job_details enable row level security;
alter table job_equipment enable row level security;

-- Mirrors install_forms_select/insert/update from 20260103000000_rls.sql
-- exactly (same admin(now superadmin)/manager-always,
-- engineer-while-not-yet-submitted shape) -- job_details is that table's
-- generalisation, not a different access model.
create policy job_details_select on job_details for select using (
  exists (select 1 from jobs where jobs.id = job_details.job_id)
);
create policy job_details_insert on job_details for insert with check (
  exists (
    select 1 from jobs
    where jobs.id = job_details.job_id
    and (
      current_user_role() in ('superadmin', 'manager')
      or (
        jobs.assigned_to = auth.uid()
        and jobs.status not in ('submitted', 'under_review', 'approved', 'closed')
      )
    )
  )
);
create policy job_details_update on job_details for update using (
  exists (
    select 1 from jobs
    where jobs.id = job_details.job_id
    and (
      current_user_role() in ('superadmin', 'manager')
      or (
        jobs.assigned_to = auth.uid()
        and jobs.status not in ('submitted', 'under_review', 'approved', 'closed')
      )
    )
  )
);

-- job_equipment is office-prepared planning data (like sites/projects/
-- clients), not something an engineer edits in the field -- same "shared
-- reference data" policy shape as those, not install_forms'.
create policy job_equipment_select on job_equipment for select using (
  exists (select 1 from jobs where jobs.id = job_equipment.job_id)
);
create policy job_equipment_write on job_equipment for insert with check (current_user_role() in ('superadmin', 'manager'));
create policy job_equipment_update on job_equipment for update
  using (current_user_role() in ('superadmin', 'manager'))
  with check (current_user_role() in ('superadmin', 'manager'));
create policy job_equipment_delete on job_equipment for delete using (current_user_role() in ('superadmin', 'manager'));

-- RAMS and site plan documents reuse the existing 'media' bucket and its
-- policies (20260106000000_storage.sql) -- same jobs/{job_id}/{filename}
-- path convention, same "any signed-in user with the parent job visible"
-- access, no new bucket or storage policies needed.
