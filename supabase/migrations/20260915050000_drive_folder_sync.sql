-- Phase 1 of the Drive folder sync (see the "Drive Folder Sync" scoping
-- memo, decided 15 Sep 2026: Option A, one-way app -> Drive, hierarchy
-- Customer Jobs New / Client / Project / Site / Job). Client and project
-- folders are 1:1 with their row -- a project belongs to exactly one
-- client -- so a plain drive_folder_id column is enough at this level.
-- Site and job folders are deliberately left for Phase 2: a site has no
-- project_id at all (see office/jobs/actions.ts's createJob comment --
-- "nothing at the DB level ties a site to a project"), so the same site
-- can end up under more than one project folder and needs a different
-- shape than one column per row.
alter table clients add column drive_folder_id text;
alter table projects add column drive_folder_id text;
