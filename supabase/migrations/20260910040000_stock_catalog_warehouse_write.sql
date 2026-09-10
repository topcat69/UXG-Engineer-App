-- Warehouse (via the kiosk) now auto-registers a scanned, uncatalogued
-- manufacturer/model into the Stock Catalog on goods-in (see
-- ensureCatalogEntry in kiosk/[id]/actions.ts) — insert/update were
-- previously superadmin/manager only, which would have silently failed
-- every auto-registration attempt from the one role that actually
-- triggers it. Delete stays Office-only: removing a catalog entry is a
-- curation call, not something a goods-in scan should ever do.
drop policy stock_manufacturers_write on stock_manufacturers;
create policy stock_manufacturers_write on stock_manufacturers for insert with check (
  current_user_role() in ('superadmin', 'manager', 'warehouse')
);
drop policy stock_manufacturers_update on stock_manufacturers;
create policy stock_manufacturers_update on stock_manufacturers for update
  using (current_user_role() in ('superadmin', 'manager', 'warehouse'))
  with check (current_user_role() in ('superadmin', 'manager', 'warehouse'));

drop policy stock_models_write on stock_models;
create policy stock_models_write on stock_models for insert with check (
  current_user_role() in ('superadmin', 'manager', 'warehouse')
);
drop policy stock_models_update on stock_models;
create policy stock_models_update on stock_models for update
  using (current_user_role() in ('superadmin', 'manager', 'warehouse'))
  with check (current_user_role() in ('superadmin', 'manager', 'warehouse'));
