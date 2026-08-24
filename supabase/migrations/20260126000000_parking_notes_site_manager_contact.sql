-- "Parking notified" (yes/no) and "Reported to site manager" (yes/no) had
-- nowhere to record the actual detail behind each answer: what parking
-- restrictions apply, and who at the site was actually reported to.
alter table job_details add column parking_notes text;
alter table job_details add column site_manager_name text;
alter table job_details add column site_manager_phone text;
