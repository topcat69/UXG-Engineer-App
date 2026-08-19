-- Free-text notes the office adds while preparing a job ("Job
-- Information" panel, formerly "Info on system") — unlimited length
-- (Postgres text has no practical limit), shown read-only to the
-- engineer in the field app.
alter table job_details add column job_information text;
