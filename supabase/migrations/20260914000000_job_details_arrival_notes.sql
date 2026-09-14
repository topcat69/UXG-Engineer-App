-- "State of affairs on arrival" — a free-text field alongside the arrival
-- photos (photo_before/photo_equipment_in_situ, see earlyPhotoSlotsFor in
-- job-form.ts), so the engineer records in words what they found on site
-- before any work starts, not just in pictures. Same install/sla/maintenance
-- scope as those photos — delivery has no arrival-to-diagnose moment.
alter table job_details add column arrival_notes text;
