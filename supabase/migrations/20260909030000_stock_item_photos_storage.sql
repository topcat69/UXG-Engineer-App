-- Private bucket for the Stock Item photo the real job sheet's "Image
-- Link" column calls for — deliberately its own follow-up rather than
-- part of the original Goods-In & Job Sheets build (see the proposal's
-- parked item): PhotoSlot.tsx is tightly coupled to the field app's
-- offline Dexie queue, not a fit for the kiosk's always-online, direct-
-- to-Storage model, so this gets its own small upload path instead of
-- reusing that component. Path convention: {job_sheet_id}/{filename}.
--
-- Policies mirror job_sheets' own RLS shape — readable wherever the
-- parent Job Sheet is visible (transitively covers the assigned
-- engineer once a sheet's linked to their job, same as stock_items_select
-- itself), writable only by the roles that can actually touch a Stock
-- Item (superadmin/manager/warehouse — see stock_items_insert/_delete).

insert into storage.buckets (id, name, public)
values ('stock-item-photos', 'stock-item-photos', false)
on conflict (id) do nothing;

create policy stock_item_photos_objects_select on storage.objects for select using (
  bucket_id = 'stock-item-photos'
  and (storage.foldername(name))[1]::uuid in (select id from public.job_sheets)
);

create policy stock_item_photos_objects_insert on storage.objects for insert with check (
  bucket_id = 'stock-item-photos'
  and current_user_role() in ('superadmin', 'manager', 'warehouse')
);

create policy stock_item_photos_objects_delete on storage.objects for delete using (
  bucket_id = 'stock-item-photos'
  and current_user_role() in ('superadmin', 'manager', 'warehouse')
);
