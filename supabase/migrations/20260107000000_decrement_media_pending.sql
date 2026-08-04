-- Phase 3: atomic decrement for jobs.media_pending. The obvious
-- read-then-write in application code (select media_pending, then update
-- with value-1) loses updates whenever two decrements for the same job
-- overlap — e.g. a network reconnect firing mid-drain lets two upload
-- completions race. A single UPDATE using the column's current value in
-- the same statement is atomic under Postgres's row-level locking, so this
-- can't lose a decrement no matter how many callers overlap.
create function decrement_media_pending(p_job_id uuid) returns void
language sql as $$
  update jobs set media_pending = greatest(0, media_pending - 1) where id = p_job_id;
$$;

grant execute on function decrement_media_pending(uuid) to authenticated, service_role;
