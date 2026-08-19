-- Field app engineers can now delete a captured photo/video before
-- submission (see deleteMediaItem in src/lib/offline/media-capture.ts and
-- the "media_delete" outbox op in src/lib/offline/outbox.ts). That needs a
-- DELETE policy on both the media_assets/signatures tables and the
-- storage.objects rows for the 'media' bucket — none existed before now,
-- only select/insert/update. Scoped identically to the existing
-- select/insert/update policies from 20260103000000_rls.sql and
-- 20260106000000_storage.sql (wherever the parent job is visible).

create policy media_assets_delete on media_assets for delete using (
  job_id in (select id from jobs)
);

create policy signatures_delete on signatures for delete using (
  job_id in (select id from jobs)
);

create policy media_objects_delete on storage.objects for delete using (
  bucket_id = 'media'
  and (storage.foldername(name))[2]::uuid in (select id from public.jobs)
);
