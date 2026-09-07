-- Private bucket for Knowledge Base article attachments (PDF/video) --
-- kept separate from the job-scoped `media` bucket (jobs/{job_id}/...
-- path convention, 20260106000000_storage.sql) since KB attachments
-- aren't scoped to a job at all. Path convention:
-- kb-articles/{article_id}/{filename}.
--
-- Policies mirror kb_articles/kb_article_attachments' own RLS shape --
-- readable wherever the parent article is visible, writable wherever
-- it's still editable (office always, or the author while draft/declined).

insert into storage.buckets (id, name, public)
values ('kb-attachments', 'kb-attachments', false)
on conflict (id) do nothing;

create policy kb_attachments_objects_select on storage.objects for select using (
  bucket_id = 'kb-attachments'
  and (storage.foldername(name))[2]::uuid in (
    select id from public.kb_articles
    where status = 'published'
       or author_id = auth.uid()
       or current_user_role() in ('superadmin', 'manager')
  )
);

create policy kb_attachments_objects_insert on storage.objects for insert with check (
  bucket_id = 'kb-attachments'
  and (storage.foldername(name))[2]::uuid in (
    select id from public.kb_articles
    where current_user_role() in ('superadmin', 'manager')
       or (author_id = auth.uid() and status in ('draft', 'declined'))
  )
);

create policy kb_attachments_objects_delete on storage.objects for delete using (
  bucket_id = 'kb-attachments'
  and (storage.foldername(name))[2]::uuid in (
    select id from public.kb_articles
    where current_user_role() in ('superadmin', 'manager')
       or (author_id = auth.uid() and status in ('draft', 'declined'))
  )
);
