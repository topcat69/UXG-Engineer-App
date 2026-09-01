-- Free-form purchase order reference, entered by the office once a job's
-- billing/PO number is known. Not required at creation (createJob doesn't
-- collect it, same as priority/description) — set later via updateJob.
alter table jobs add column quickbooks_no text;
