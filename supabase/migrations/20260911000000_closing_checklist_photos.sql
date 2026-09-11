-- The closing checklist's "Photo taken" checkboxes had nothing behind
-- them — a manual assertion with no actual way to attach the photo it
-- claimed existed. Adds a storage path per item so there's a real photo
-- to upload and view, same pattern as the Stock Item photo capture.
-- Reuses the stock-item-photos bucket rather than a new one: its RLS
-- already scopes access by job_sheet_id as the path's first segment,
-- and a closing-checklist photo is scoped identically (see
-- 20260909030000_stock_item_photos_storage.sql).
alter table job_sheets add column defects_photo_path text;
alter table job_sheets add column missing_items_photo_path text;
alter table job_sheets add column packed_correctly_photo_path text;
alter table job_sheets add column other_parts_used_photo_path text;
alter table job_sheets add column other_issues_photo_path text;
