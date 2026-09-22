-- Lets Office tag a Stock Catalog manufacturer with the Asset Register
-- category its kit falls under (e.g. "Sony" -> "Display"), so Asset
-- Register rows with a matching manufacturer can be bulk-categorised from
-- one place instead of picking a category on every asset individually.
-- Nullable and optional, same "picklist is convenience" spirit as the rest
-- of Stock Catalog — a manufacturer with no category set just can't drive
-- that backfill yet. on delete set null, not restrict: deleting an Asset
-- Register category shouldn't be blocked by, or silently break, a
-- manufacturer that happened to reference it.
alter table stock_manufacturers add column category_id uuid references asset_categories(id) on delete set null;
create index on stock_manufacturers (category_id);
