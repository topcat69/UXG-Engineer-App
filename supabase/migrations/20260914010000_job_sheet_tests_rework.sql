-- Configuration/Testing rework (the section's heading changes from
-- "Testing" to "Configuration" — cosmetic only, table/column names below
-- keep their existing shape rather than churning every reference for a
-- label change):
--
--  - Drop ir_bud entirely — flagged unused, no longer collected.
--  - wifi_cable -> wifi_dongle: renamed to match the real hardware, and
--    now driven by a fixed Yes/No/N/A choice at the app layer rather than
--    a free-text input (still a plain text column here, same convention
--    as mount_type/power_source etc. elsewhere in this schema).
--  - stock_item_id links a row to the goods-in scan it's configuring, so
--    Configuration can show that item's own manufacturer/model/serial
--    live (via a join) instead of a separately-typed description that'd
--    drift out of sync the moment someone corrects a typo on the Stock
--    Items table. item_description remains, now only for a row that's
--    part of this job but never went through goods-in (e.g. hardware
--    already on site) — addStockItem populates stock_item_id instead of
--    item_description for every row it creates.
--  - licence_added/teamviewer_added/added_to_uxg_account move here from
--    job_sheets: each needs actioning per item, not once for the whole
--    sheet. philips_wave_added joins them as a new checkbox.
--
-- Dropping those three columns from job_sheets loses any value already
-- recorded there — there's no clean way to carry a whole-sheet flag onto
-- one specific item after the fact, and per PROMPT.md this app hasn't
-- gone properly live yet (see the standing "reset business data before
-- real use" task).
alter table job_sheet_tests drop column ir_bud;
alter table job_sheet_tests rename column wifi_cable to wifi_dongle;
alter table job_sheet_tests add column stock_item_id uuid references stock_items(id) on delete cascade;
alter table job_sheet_tests add column licence_added boolean;
alter table job_sheet_tests add column teamviewer_added boolean;
alter table job_sheet_tests add column philips_wave_added boolean;
alter table job_sheet_tests add column added_to_uxg_account boolean;
create index on job_sheet_tests (stock_item_id);

alter table job_sheets drop column licence_added;
alter table job_sheets drop column teamviewer_added;
alter table job_sheets drop column added_to_uxg_account;
