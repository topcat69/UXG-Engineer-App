-- Phase 3: a single private bucket for all job media (photos, signatures).
-- Path convention: jobs/{job_id}/{filename}, matching media_assets.storage_path
-- and signatures.storage_path already used by the Phase 1 seed data.
--
-- storage.objects already has RLS enabled by default in Supabase. Policies
-- mirror the media_assets/signatures table policies from
-- 20260103000000_rls.sql: readable/writable wherever the parent job (parsed
-- out of the object path) is visible to the current user.

insert into storage.buckets (id, name, public)
values ('media', 'media', false)
on conflict (id) do nothing;

create policy media_objects_select on storage.objects for select using (
  bucket_id = 'media'
  and (storage.foldername(name))[2]::uuid in (select id from public.jobs)
);

create policy media_objects_insert on storage.objects for insert with check (
  bucket_id = 'media'
  and (storage.foldername(name))[2]::uuid in (select id from public.jobs)
);

create policy media_objects_update on storage.objects for update using (
  bucket_id = 'media'
  and (storage.foldername(name))[2]::uuid in (select id from public.jobs)
);
