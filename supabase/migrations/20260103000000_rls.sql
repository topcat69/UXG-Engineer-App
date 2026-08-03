-- Phase 1: RLS. Enforced in the database, never assumed in the UI.
--
-- Assumptions made where PROMPT.md's "RLS policies" section doesn't spell out
-- every table (recorded here and in DECISIONS.md):
--   - `service_role` always bypasses RLS (Postgres/Supabase default) — seed
--     scripts, migrations and any server-side job that needs unrestricted
--     access use it, so no policy below needs to special-case it.
--   - `projects`, `sites`, `assets` are shared reference data engineers need
--     to see to work a job (site address, access notes, asset history), so
--     engineers get read access to all of them, not just ones tied to a
--     visible job. Only admin/manager can write them (office-side data).
--   - `users`: everyone can read their own row (needed for the app to know
--     its own role); admin/manager can read everyone. Only admin can write,
--     matching the AppSheet role model ("Admin: everything, plus app
--     editing"; manager doesn't manage the roster).
--   - `status_events` is genuinely append-only per the non-negotiable
--     constraint: INSERT only, no UPDATE/DELETE policy for any role
--     (including admin) so the audit trail can't be edited after the fact.
--   - `install_forms`/`survey_forms`: admin/manager can write any time
--     (they need to fix records during QA); engineers only while the parent
--     job isn't submitted/under_review/approved/closed, per spec.
--   - `share_links`: no SELECT policy at all — the public share route reads
--     it with the service-role client server-side, per spec ("no
--     authenticated access needed"). Only admin/manager can create links.

alter table users enable row level security;
alter table projects enable row level security;
alter table sites enable row level security;
alter table assets enable row level security;
alter table jobs enable row level security;
alter table install_forms enable row level security;
alter table survey_forms enable row level security;
alter table media_assets enable row level security;
alter table signatures enable row level security;
alter table issues enable row level security;
alter table status_events enable row level security;
alter table share_links enable row level security;

-- Helper: current user's role, looked up once per statement.
create function current_user_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from users where id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
create policy users_select on users for select
  using (id = auth.uid() or current_user_role() in ('admin','manager'));

create policy users_write on users for all
  using (current_user_role() = 'admin')
  with check (current_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- projects / sites / assets — shared reference data
-- ---------------------------------------------------------------------------
create policy projects_select on projects for select using (true);
create policy projects_write on projects for insert with check (current_user_role() in ('admin','manager'));
create policy projects_update on projects for update
  using (current_user_role() in ('admin','manager'))
  with check (current_user_role() in ('admin','manager'));
create policy projects_delete on projects for delete using (current_user_role() in ('admin','manager'));

create policy sites_select on sites for select using (true);
create policy sites_write on sites for insert with check (current_user_role() in ('admin','manager'));
create policy sites_update on sites for update
  using (current_user_role() in ('admin','manager'))
  with check (current_user_role() in ('admin','manager'));
create policy sites_delete on sites for delete using (current_user_role() in ('admin','manager'));

create policy assets_select on assets for select using (true);
create policy assets_write on assets for insert with check (current_user_role() in ('admin','manager'));
create policy assets_update on assets for update
  using (current_user_role() in ('admin','manager'))
  with check (current_user_role() in ('admin','manager'));
create policy assets_delete on assets for delete using (current_user_role() in ('admin','manager'));

-- ---------------------------------------------------------------------------
-- jobs — the date-windowed engineer filter is a performance requirement as
-- much as a security one: it bounds what syncs to the phone.
-- ---------------------------------------------------------------------------
create policy jobs_select on jobs for select using (
  current_user_role() in ('admin','manager')
  or (
    assigned_to = auth.uid()
    and scheduled_start between now() - interval '30 days' and now() + interval '14 days'
  )
);

create policy jobs_insert on jobs for insert with check (
  current_user_role() in ('admin','manager')
);

create policy jobs_update on jobs for update using (
  current_user_role() in ('admin','manager')
  or assigned_to = auth.uid()
) with check (
  current_user_role() in ('admin','manager')
  or assigned_to = auth.uid()
);

-- ---------------------------------------------------------------------------
-- install_forms / survey_forms
-- ---------------------------------------------------------------------------
create policy install_forms_select on install_forms for select using (
  exists (select 1 from jobs where jobs.id = install_forms.job_id)
);
create policy install_forms_insert on install_forms for insert with check (
  exists (
    select 1 from jobs
    where jobs.id = install_forms.job_id
    and (
      current_user_role() in ('admin','manager')
      or (
        jobs.assigned_to = auth.uid()
        and jobs.status not in ('submitted','under_review','approved','closed')
      )
    )
  )
);
create policy install_forms_update on install_forms for update using (
  exists (
    select 1 from jobs
    where jobs.id = install_forms.job_id
    and (
      current_user_role() in ('admin','manager')
      or (
        jobs.assigned_to = auth.uid()
        and jobs.status not in ('submitted','under_review','approved','closed')
      )
    )
  )
);

create policy survey_forms_select on survey_forms for select using (
  exists (select 1 from jobs where jobs.id = survey_forms.job_id)
);
create policy survey_forms_insert on survey_forms for insert with check (
  exists (
    select 1 from jobs
    where jobs.id = survey_forms.job_id
    and (
      current_user_role() in ('admin','manager')
      or (
        jobs.assigned_to = auth.uid()
        and jobs.status not in ('submitted','under_review','approved','closed')
      )
    )
  )
);
create policy survey_forms_update on survey_forms for update using (
  exists (
    select 1 from jobs
    where jobs.id = survey_forms.job_id
    and (
      current_user_role() in ('admin','manager')
      or (
        jobs.assigned_to = auth.uid()
        and jobs.status not in ('submitted','under_review','approved','closed')
      )
    )
  )
);

-- ---------------------------------------------------------------------------
-- media_assets / signatures — readable/writable where the parent job is
-- visible. `jobs_select` already reflects the date-windowed filter, so this
-- inherits it automatically.
-- ---------------------------------------------------------------------------
create policy media_assets_select on media_assets for select using (
  job_id in (select id from jobs)
);
create policy media_assets_insert on media_assets for insert with check (
  job_id in (select id from jobs)
);
create policy media_assets_update on media_assets for update using (
  job_id in (select id from jobs)
);

create policy signatures_select on signatures for select using (
  job_id in (select id from jobs)
);
create policy signatures_insert on signatures for insert with check (
  job_id in (select id from jobs)
);

-- ---------------------------------------------------------------------------
-- issues — visible/raisable wherever the related job is visible.
-- ---------------------------------------------------------------------------
create policy issues_select on issues for select using (
  job_id in (select id from jobs)
);
create policy issues_insert on issues for insert with check (
  job_id in (select id from jobs)
);
create policy issues_update on issues for update using (
  current_user_role() in ('admin','manager')
) with check (
  current_user_role() in ('admin','manager')
);

-- ---------------------------------------------------------------------------
-- status_events — append-only. No update/delete policy for any role.
-- ---------------------------------------------------------------------------
create policy status_events_select on status_events for select using (
  job_id in (select id from jobs)
);
create policy status_events_insert on status_events for insert with check (
  job_id in (select id from jobs)
);

-- ---------------------------------------------------------------------------
-- share_links — no SELECT policy; the public share route uses the
-- service-role client, which bypasses RLS entirely.
-- ---------------------------------------------------------------------------
create policy share_links_insert on share_links for insert with check (
  current_user_role() in ('admin','manager')
);
create policy share_links_update on share_links for update using (
  current_user_role() in ('admin','manager')
) with check (
  current_user_role() in ('admin','manager')
);
