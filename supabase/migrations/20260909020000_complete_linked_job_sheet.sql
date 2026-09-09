-- Phase 6 of Goods-In & Job Sheets: submitting a job whose Job Sheet was
-- assigned to it (see job_sheets.linked_job_id, phase 5) flips that sheet
-- to Complete and its Stock Items to Installed.
--
-- Same status_events "submitted" trigger point as
-- 20260109000000_status_submitted_webhook.sql, for the same reason: the
-- database is the only place guaranteed to see every submission
-- regardless of client — the field app writes status_events directly via
-- PostgREST during an offline sync, never through a Next.js server
-- action, so an app-layer hook would miss that path entirely.
--
-- security definer because the engineer who triggers this (via their own
-- status_events insert) has no RLS access to update job_sheets/stock_items
-- themselves (job_sheets_update/stock_items_update are
-- superadmin/manager/warehouse-only) — same pattern as set_own_theme in
-- 20260123000000_user_theme.sql sidestepping RLS for one narrow,
-- deliberate write.
create function complete_linked_job_sheet() returns trigger as $$
begin
  if new.to_status = 'submitted' then
    update stock_items
    set status = 'installed'
    where status <> 'installed'
      and job_sheet_id in (select id from job_sheets where linked_job_id = new.job_id);

    update job_sheets
    set status = 'complete'
    where status <> 'complete'
      and linked_job_id = new.job_id;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger status_events_complete_job_sheet
  after insert on status_events
  for each row execute function complete_linked_job_sheet();
