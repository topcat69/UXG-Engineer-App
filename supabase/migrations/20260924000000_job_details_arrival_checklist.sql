-- Arrival checklist: four fixed-vocabulary questions engineers answer as
-- soon as they check in, before writing free-text notes in arrival_notes
-- (20260914000000_job_details_arrival_notes.sql) — same
-- fixed-vocabulary-column pattern as pass_fail/equipment_damage_status.
-- job_details only: this is a live-form field, same scope as arrival_notes
-- itself (install_forms is the read-only legacy migrated-data path).
create type yes_no_na as enum ('yes', 'no', 'na');

alter table job_details add column health_safety_checks_complete yes_no_na;
alter table job_details add column equipment_located yes_no_na;
alter table job_details add column working_order_check yes_no_na;
alter table job_details add column obvious_damage_check yes_no_na;
