-- The engineer-visible scheduling window on jobs (20260103000000_rls.sql)
-- was +14 days forward — too narrow now that the office schedules work a
-- month or more out (a real report: a job scheduled 32 days ahead never
-- appeared in the field app, since RLS silently excluded it, not a display
-- bug). Widened to a symmetric ±30 days, matching the existing 30-day
-- look-back. Still a bounded window, not unlimited — this exists as much
-- to cap what syncs to each engineer's phone as to scope visibility, per
-- that migration's own comment.
drop policy jobs_select on jobs;
create policy jobs_select on jobs for select using (
  current_user_role() in ('superadmin','manager')
  or (
    assigned_to = auth.uid()
    and scheduled_start between now() - interval '30 days' and now() + interval '30 days'
  )
);
