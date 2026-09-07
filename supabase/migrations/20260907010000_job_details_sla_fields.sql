-- Two new FKs for the "SLA" job type specifically, into the per-customer
-- lookup lists added in the previous migration: fixture_type_id is set by
-- the office at SLA creation time (a site fact, like job_information/
-- rams_storage_path -- read-only to the engineer, carried over on a
-- revisit); reason_id is set by the engineer at completion, alongside the
-- existing action/part/sign-off-style fields -- only known once diagnosed
-- on site, so like player_boot_test/issues_found it's an outcome of that
-- specific visit, not a site fact, and is NOT carried over on a revisit
-- (see cloneJobDetailsForRevisit).
--
-- job_details.sla_requirement_detail is untouched by this migration -- it's
-- a separate, pre-existing free-text field also used by the unrelated
-- "maintenance" job type (a contractual response-time note, e.g. "4-hour
-- response"), not something this SLA-job-type feature owns or replaces.
--
-- No cascade on delete, same as every other FK in this schema referencing
-- reference data an engineer's history points at -- a fixture type/reason
-- being retired should never silently blank out or delete past job_details.

alter table job_details add column fixture_type_id uuid references client_sla_fixture_types(id);
alter table job_details add column reason_id uuid references client_sla_reasons(id);
