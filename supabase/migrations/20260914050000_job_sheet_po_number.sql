-- Job Sheets get their own PO Number, kept in sync with the linked job's
-- existing `quickbooks_no` column (see 20260130000000_quickbooks_no.sql —
-- already documented there as "Free-form purchase order reference", i.e.
-- the same concept, not a new one). The sync itself is application-level
-- (see assignJobSheetToJob and the new updateJobSheetPoNumber action in
-- src/app/office/job-sheets), not a DB trigger — every write already goes
-- through a Next.js server action here, unlike the field app's direct
-- writes that needed a trigger in complete_linked_job_sheet().
alter table job_sheets add column po_number text;
