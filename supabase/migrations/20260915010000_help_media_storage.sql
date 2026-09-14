-- Private bucket for Help Guides screenshots and videos, separate from
-- kb-attachments (KB is equipment docs, this is app-usage docs — see
-- 20260915000000_help_guides.sql). Path convention: help-media/{article_id}/{filename}.
--
-- Policies mirror help_articles' own RLS shape — readable wherever the
-- parent article is visible, writable only by superadmin/manager.

insert into storage.buckets (id, name, public)
values ('help-media', 'help-media', false)
on conflict (id) do nothing;

create policy help_media_objects_select on storage.objects for select using (
  bucket_id = 'help-media'
  and (
    current_user_role() in ('superadmin', 'manager')
    or (storage.foldername(name))[1]::uuid in (
      select id from public.help_articles where category_id in (
        select id from public.help_categories where role is null or role = current_user_role()
      )
    )
  )
);

create policy help_media_objects_insert on storage.objects for insert with check (
  bucket_id = 'help-media' and current_user_role() in ('superadmin', 'manager')
);

create policy help_media_objects_delete on storage.objects for delete using (
  bucket_id = 'help-media' and current_user_role() in ('superadmin', 'manager')
);
