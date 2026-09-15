-- Phase 4 of the Drive folder sync: mirrors the completion report PDF
-- (already generated on QA approval, see lib/pdf/completion-report.ts)
-- into its job's Drive folder, same drive_file_id pattern as Phase 3's
-- media_assets/signatures/job_details documents.
alter table jobs add column completion_report_drive_file_id text;
