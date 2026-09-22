-- Deleting a job (see deleteJobAction, added in
-- 20260115000000_superadmin_role_and_job_delete.sql) fails with a foreign
-- key violation whenever a Job Sheet is linked to it: job_sheets.linked_job_id
-- was added later, in 20260909010000_goods_in_job_sheets.sql, as a bare
-- `references jobs(id)` and never got the same on-delete treatment that
-- migration gave every other jobs(id) reference. Same reasoning as
-- parent_job_id/revisit_job_id there: this is a cross-reference (which job
-- this sheet is currently out for), not ownership — deleting the job
-- should unlink the sheet, not be blocked by it or take the sheet down too.
alter table job_sheets drop constraint job_sheets_linked_job_id_fkey;
alter table job_sheets add constraint job_sheets_linked_job_id_fkey
  foreign key (linked_job_id) references jobs(id) on delete set null;

-- The FK only clears linked_job_id itself; without this, a sheet whose job
-- got deleted would keep showing "Assigned" with no job to point at, and
-- silently reappear in every unassigned-sheet picker (which key off
-- linked_job_id is null, not status) still labelled Assigned. Only reset a
-- sheet that hadn't already reached 'complete' — that status reflects real
-- work done and shouldn't be undone by the job row going away afterwards.
-- security definer for the same reason as complete_linked_job_sheet in
-- 20260909020000_complete_linked_job_sheet.sql: whoever deletes the job
-- (manager) has no RLS access to update job_sheets directly.
create function unassign_job_sheet_on_job_delete() returns trigger as $$
begin
  -- Only the status; linked_job_id is left for the FK's own on-delete-set-null
  -- above to clear (it runs against every referencing row regardless).
  update job_sheets
  set status = 'ready'
  where linked_job_id = old.id and status <> 'complete';
  return old;
end;
$$ language plpgsql security definer set search_path = public;

create trigger jobs_before_delete_unassign_job_sheet
  before delete on jobs
  for each row execute function unassign_job_sheet_on_job_delete();
