-- Fourth office-prepared document, same pattern as RAMS/site plan/design
-- pack (20260117000000_job_details.sql, 20260131000000_design_pack.sql) —
-- placed next to parking considerations rather than the other documents,
-- since that's what it's actually for.
alter table job_details add column parking_permit_storage_path text;
