-- Phase 3 follow-up: decrement_media_pending() (previous migration) fixed
-- decrement-vs-decrement races, but not decrement-vs-initialization races.
-- In real usage, photos upload — and decrement — as soon as they're
-- captured, well before "Check Out & Submit" is tapped, because uploads are
-- eager. submitJob() used to *set* media_pending to an absolute count via a
-- plain job_patch, which could stomp decrements that had already landed
-- from photos captured earlier in the same job. Reproduced reliably by the
-- offline E2E test once uploads started racing the submit patch across a
-- reconnect.
--
-- The fix: never assign an absolute value. Every enqueue adds 1, every
-- upload subtracts 1, and addition/subtraction commute regardless of
-- arrival order, so the running total is correct no matter how the enqueue
-- and upload queues interleave. This deliberately does not clamp at 0 —
-- clamping is exactly what discarded the "debt" from a decrement that
-- arrived before its matching increment.
drop function if exists decrement_media_pending(uuid);

create function adjust_media_pending(p_job_id uuid, p_delta integer) returns void
language sql as $$
  update jobs set media_pending = media_pending + p_delta where id = p_job_id;
$$;

grant execute on function adjust_media_pending(uuid, integer) to authenticated, service_role;
