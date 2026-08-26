-- "Record if there is any damage to equipment recorded" — a classification
-- dropdown sitting next to the existing issues_found/issue_detail pair on
-- both install_forms (survey job type) and job_details (install/sla/
-- maintenance/delivery), same fixed-vocabulary-column pattern as pass_fail.
create type equipment_damage_status as enum ('na', 'yes', 'accidental', 'customer');

alter table install_forms add column equipment_damage equipment_damage_status;
alter table job_details add column equipment_damage equipment_damage_status;
