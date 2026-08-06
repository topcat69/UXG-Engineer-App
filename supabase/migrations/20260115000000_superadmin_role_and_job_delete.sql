-- Roles: rename 'admin' -> 'superadmin' (still 3 roles total: superadmin/
-- manager/engineer, per updated product requirements), give manager the
-- ability to manage the user roster (previously superadmin/admin-only),
-- and allow deleting a job outright (previously no role could -- only
-- cancel it, which just sets status = 'cancelled').
--
-- Safe to rename the enum label in place: every RLS policy written
-- against the 'admin' literal in 20260103000000_rls.sql and later
-- (20260114000000_job_templates_tasks.sql) keeps working unchanged after
-- this runs. Postgres resolves an enum literal to a stable internal value
-- at CREATE POLICY time; RENAME VALUE only changes the label future
-- queries use to refer to that same value, not an already-resolved
-- reference baked into an existing policy. Nothing in either of those
-- files needs to be touched, and any 'admin' rows in an already-seeded
-- database transparently become 'superadmin' rows -- same value, new
-- label, no data migration required.
alter type user_role rename value 'admin' to 'superadmin';

-- Manager can now create/deactivate/edit user accounts too -- but only
-- engineer accounts. Previously users_write was superadmin(admin)-only
-- ("manager doesn't manage the roster", per the original assumption note
-- in 20260103000000_rls.sql) -- that assumption no longer holds, but
-- unrestricted user-management for manager would leave nothing that
-- actually operationalizes "superadmin has carte blanche" versus a
-- manager's bounded list: a manager could otherwise create a second
-- superadmin, delete the real one, or promote themselves. `using`
-- constrains which existing rows a manager can touch (update/delete) to
-- ones already role='engineer'; `with check` constrains what an insert or
-- update can leave the row as, so a manager can't promote an engineer to
-- manager/superadmin either. Superadmin is unrestricted, full carte
-- blanche over the roster, per spec.
drop policy users_write on users;
create policy users_write on users for all
  using (
    current_user_role() = 'superadmin'
    or (current_user_role() = 'manager' and role = 'engineer')
  )
  with check (
    current_user_role() = 'superadmin'
    or (current_user_role() = 'manager' and role = 'engineer')
  );

-- Jobs could previously only be cancelled (a status change), never
-- actually removed. Manager/superadmin can now delete a job outright.
create policy jobs_delete on jobs for delete using (
  current_user_role() in ('superadmin', 'manager')
);

-- Deleting a job needs the rows it owns to go with it, or be unlinked for
-- cross-references that aren't ownership, rather than blocking on a
-- foreign key violation. media_assets/signatures/status_events/
-- install_forms/survey_forms/job_tasks already cascade (see
-- 20260102000000_schema.sql and 20260114000000_job_templates_tasks.sql);
-- these four didn't.
alter table issues drop constraint issues_job_id_fkey;
alter table issues add constraint issues_job_id_fkey
  foreign key (job_id) references jobs(id) on delete cascade;

-- revisit_job_id is a cross-reference (this issue's linked revisit job),
-- not ownership -- deleting the revisit should clear the pointer, not be
-- blocked by it.
alter table issues drop constraint issues_revisit_job_id_fkey;
alter table issues add constraint issues_revisit_job_id_fkey
  foreign key (revisit_job_id) references jobs(id) on delete set null;

alter table share_links drop constraint share_links_job_id_fkey;
alter table share_links add constraint share_links_job_id_fkey
  foreign key (job_id) references jobs(id) on delete cascade;

-- parent_job_id is also a cross-reference (this job is a revisit of that
-- one) -- deleting the parent shouldn't cascade-delete every revisit it
-- ever spawned, just clear the link.
alter table jobs drop constraint jobs_parent_job_id_fkey;
alter table jobs add constraint jobs_parent_job_id_fkey
  foreign key (parent_job_id) references jobs(id) on delete set null;
