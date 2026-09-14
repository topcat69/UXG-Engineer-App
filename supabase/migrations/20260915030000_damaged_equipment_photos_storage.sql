-- Private bucket for Damaged Equipment photos. A new bucket rather than
-- reusing stock-item-photos: that bucket's RLS scopes access by
-- job_sheet_id as the path's first segment (see
-- 20260909030000_stock_item_photos_storage.sql), which a manually-logged
-- damaged item (no job sheet at all) can't satisfy. Path convention:
-- damaged-equipment-photos/{damaged_equipment_id}/{filename}.
insert into storage.buckets (id, name, public)
values ('damaged-equipment-photos', 'damaged-equipment-photos', false)
on conflict (id) do nothing;

create policy damaged_equipment_photos_select on storage.objects for select using (
  bucket_id = 'damaged-equipment-photos' and current_user_role() in ('superadmin', 'manager', 'warehouse', 'finance')
);

create policy damaged_equipment_photos_insert on storage.objects for insert with check (
  bucket_id = 'damaged-equipment-photos' and current_user_role() in ('superadmin', 'manager', 'warehouse', 'finance')
);

create policy damaged_equipment_photos_delete on storage.objects for delete using (
  bucket_id = 'damaged-equipment-photos' and current_user_role() in ('superadmin', 'manager', 'warehouse', 'finance')
);
