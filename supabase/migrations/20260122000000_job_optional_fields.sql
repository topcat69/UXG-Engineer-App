-- Per-job override of which job_details form fields an engineer must fill
-- in before submitting. Today "required" is a single hardcoded rule per
-- job_type (validateJobDetails in lib/forms/job-form.ts) with no way to
-- relax it for one specific job that genuinely doesn't need a given field
-- (e.g. no WiFi signal reading on a job with no WiFi at all). A manager
-- needs that per-job override.
--
-- Deliberately sparse: rather than a row per field per job, only the
-- fields a manager has opted OUT of are stored here — presence of a row
-- means "optional for this job", absence means "required" (the default).
-- That means every job that already exists, and every new job, starts
-- fully mandatory with zero rows and no backfill needed — "by default
-- everything is mandatory" falls out of the schema for free.
--
-- Same shape as job_equipment (20260117000000_job_details.sql): office-
-- prepared configuration the engineer reads but never writes.
create table job_optional_fields (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references jobs(id) on delete cascade not null,
  field_key text not null,
  created_at timestamptz default now()
);
create unique index on job_optional_fields (job_id, field_key);

alter table job_optional_fields enable row level security;

create policy job_optional_fields_select on job_optional_fields for select using (
  exists (select 1 from jobs where jobs.id = job_optional_fields.job_id)
);
create policy job_optional_fields_insert on job_optional_fields for insert
  with check (current_user_role() in ('superadmin', 'manager'));
create policy job_optional_fields_delete on job_optional_fields for delete
  using (current_user_role() in ('superadmin', 'manager'));
