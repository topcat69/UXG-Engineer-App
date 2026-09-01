-- New job_status value: 'revisit' — where a rejected/superseded original
-- job lands. QA rejection creates a linked revisit job to redo the work
-- (see create-revisit.ts), so the original is genuinely finished, not
-- back in play: it previously moved to 'draft', which wrongly reopened it
-- in the engineer queue and for direct field writes, as if it were a new
-- unstarted job rather than a closed-out one. 'revisit' reads that intent
-- correctly while staying visually distinct from a normal 'closed'
-- (approved) or 'cancelled' job.
alter type job_status add value if not exists 'revisit' after 'cancelled';
