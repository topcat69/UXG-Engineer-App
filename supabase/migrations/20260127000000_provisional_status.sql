-- New job_status value: 'provisional' — a job that's been assigned/scheduled
-- and already has its email + calendar event sent, but isn't confirmed yet.
-- Sits right after 'draft' since it's still a pre-work state the office can
-- promote to 'scheduled' once confirmed (see assignAndScheduleJob).
alter type job_status add value if not exists 'provisional' after 'draft';
