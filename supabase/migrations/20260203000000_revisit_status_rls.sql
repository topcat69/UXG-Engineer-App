-- Extends the engineer-write lock (install_forms/survey_forms/job_details
-- insert+update) to the new 'revisit' status alongside the existing
-- submitted/under_review/approved/closed set — a job QA has rejected into
-- a revisit is done, the same as a closed one, and an engineer shouldn't
-- be able to edit its form data in the field any more (the redo happens on
-- the new revisit job instead). Kept as its own migration, after the
-- 20260202000000 ALTER TYPE ADD VALUE, because a new enum value can't be
-- referenced in the same transaction that adds it.
--
-- Uses 'superadmin' here, not the 'admin' literal install_forms_insert/
-- update and survey_forms_insert/update were originally created with in
-- 20260103000000_rls.sql: that literal still works unchanged in those
-- *existing* policies because 20260115000000 renamed the enum value in
-- place (old policies keep their already-resolved reference), but 'admin'
-- is no longer a valid label to type into *new* SQL — the rename means
-- only 'superadmin' parses today.

alter policy install_forms_insert on install_forms with check (
  exists (
    select 1 from jobs
    where jobs.id = install_forms.job_id
    and (
      current_user_role() in ('superadmin','manager')
      or (
        jobs.assigned_to = auth.uid()
        and jobs.status not in ('submitted','under_review','approved','closed','revisit')
      )
    )
  )
);
alter policy install_forms_update on install_forms using (
  exists (
    select 1 from jobs
    where jobs.id = install_forms.job_id
    and (
      current_user_role() in ('superadmin','manager')
      or (
        jobs.assigned_to = auth.uid()
        and jobs.status not in ('submitted','under_review','approved','closed','revisit')
      )
    )
  )
);

alter policy survey_forms_insert on survey_forms with check (
  exists (
    select 1 from jobs
    where jobs.id = survey_forms.job_id
    and (
      current_user_role() in ('superadmin','manager')
      or (
        jobs.assigned_to = auth.uid()
        and jobs.status not in ('submitted','under_review','approved','closed','revisit')
      )
    )
  )
);
alter policy survey_forms_update on survey_forms using (
  exists (
    select 1 from jobs
    where jobs.id = survey_forms.job_id
    and (
      current_user_role() in ('superadmin','manager')
      or (
        jobs.assigned_to = auth.uid()
        and jobs.status not in ('submitted','under_review','approved','closed','revisit')
      )
    )
  )
);

alter policy job_details_insert on job_details with check (
  exists (
    select 1 from jobs
    where jobs.id = job_details.job_id
    and (
      current_user_role() in ('superadmin', 'manager')
      or (
        jobs.assigned_to = auth.uid()
        and jobs.status not in ('submitted', 'under_review', 'approved', 'closed', 'revisit')
      )
    )
  )
);
alter policy job_details_update on job_details using (
  exists (
    select 1 from jobs
    where jobs.id = job_details.job_id
    and (
      current_user_role() in ('superadmin', 'manager')
      or (
        jobs.assigned_to = auth.uid()
        and jobs.status not in ('submitted', 'under_review', 'approved', 'closed', 'revisit')
      )
    )
  )
);
