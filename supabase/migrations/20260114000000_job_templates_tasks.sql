-- Job templates (a named, reusable list of tasks an office user can apply to
-- any job) and the per-job task checklist itself. Templates are generic —
-- not tied to a job_type — per explicit product decision: any template can
-- be applied to any job, so the office user picks whichever is relevant.

create table job_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create trigger job_templates_set_updated_at before update on job_templates
  for each row execute function set_updated_at();

create table job_template_tasks (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references job_templates(id) on delete cascade not null,
  position int not null,
  label text not null,
  created_at timestamptz default now()
);
create index on job_template_tasks (template_id, position);

-- Applying a template to a job copies its tasks in here as independent
-- rows (job_template_tasks stays the reusable source; job_tasks is the
-- per-job, tickable checklist) — editing a template afterwards never
-- retroactively changes tasks already applied to a job.
create table job_tasks (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references jobs(id) on delete cascade not null,
  position int not null,
  label text not null,
  is_done boolean not null default false,
  done_at timestamptz,
  done_by uuid references users(id),
  created_at timestamptz default now()
);
create index on job_tasks (job_id, position);

alter table job_templates enable row level security;
alter table job_template_tasks enable row level security;
alter table job_tasks enable row level security;

-- job_templates / job_template_tasks — office-only, like projects/sites.
create policy job_templates_select on job_templates for select
  using (current_user_role() in ('admin','manager'));
create policy job_templates_insert on job_templates for insert
  with check (current_user_role() in ('admin','manager'));
create policy job_templates_update on job_templates for update
  using (current_user_role() in ('admin','manager'));
create policy job_templates_delete on job_templates for delete
  using (current_user_role() in ('admin','manager'));

create policy job_template_tasks_select on job_template_tasks for select
  using (current_user_role() in ('admin','manager'));
create policy job_template_tasks_insert on job_template_tasks for insert
  with check (current_user_role() in ('admin','manager'));
create policy job_template_tasks_update on job_template_tasks for update
  using (current_user_role() in ('admin','manager'));
create policy job_template_tasks_delete on job_template_tasks for delete
  using (current_user_role() in ('admin','manager'));

-- job_tasks — readable/writable wherever the parent job is visible, same
-- idiom as media_assets (jobs_select's own RLS is inherited transitively
-- through the `job_id in (select id from jobs)` subquery). Only office adds
-- or removes tasks (applying a template, or an ad-hoc add); the engineer
-- assigned to the job only ever flips is_done, but row-level policies can't
-- restrict to specific columns, so update is open the same way jobs_update
-- already is for an assigned engineer.
create policy job_tasks_select on job_tasks for select
  using (job_id in (select id from jobs));
create policy job_tasks_insert on job_tasks for insert
  with check (current_user_role() in ('admin','manager'));
create policy job_tasks_update on job_tasks for update
  using (job_id in (select id from jobs));
create policy job_tasks_delete on job_tasks for delete
  using (current_user_role() in ('admin','manager'));
