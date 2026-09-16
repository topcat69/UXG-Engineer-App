-- Restructures the Drive folder sync hierarchy, per the decision on
-- 2026-09-16: Customer Jobs New / Client / Site / Job — Project is
-- dropped as a folder level entirely (a project can span several sites
-- for the same client, which would otherwise mean duplicating its
-- folder under every site it touches; the project's name is folded into
-- the job folder's own name instead, e.g. "UXG-2026-0061 — Signage
-- Rollout Phase 1"). Previously: Client / Project / Site / Job.
--
-- Site now always has exactly one parent (its client), unlike before —
-- so unlike Phase 2's original site handling, its folder genuinely is
-- 1:1 with its row and safe to cache, same as clients/jobs already are.
alter table sites add column drive_folder_id text;

-- projects.drive_folder_id (added by 20260915050000) is no longer
-- written to — Project has no folder of its own any more — but left in
-- place rather than dropped: it's harmless, nullable, and dropping a
-- production column is a separate call this migration isn't making.
