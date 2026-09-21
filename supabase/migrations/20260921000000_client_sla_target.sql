-- Report Generator Phase 1 (SLA compliance report): the one schema gap the
-- scoping memo found — job_details.sla_requirement_detail is free text
-- shared with the unrelated maintenance job type, so it can't be parsed
-- into a real target automatically. This is the structured replacement,
-- set once per customer (not per job) and read by the SLA compliance
-- report's classify step. Nullable: a customer with no target on file
-- simply can't have its SLA jobs classified met/breached yet, same
-- "nothing to show" convention as the rest of the app rather than forcing
-- a default that would misrepresent every existing customer.
alter table clients add column sla_target_hours numeric check (sla_target_hours is null or sla_target_hours > 0);
