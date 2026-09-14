-- Finance role: access to the Asset Register only — nothing else. Grants
-- select/insert/update (view, add, and fill in financial/warranty
-- details), deliberately not delete (removing an asset stays a
-- manager/superadmin action) and not asset_categories write (curating the
-- category picklist stays an admin task; finance still reads it fine via
-- asset_categories_select, which is already open to everyone).
--
-- Additive only — superadmin and manager keep exactly the access they
-- already had; this only widens who else can reach the same rows.
drop policy asset_register_select on asset_register;
create policy asset_register_select on asset_register for select using (
  current_user_role() in ('superadmin', 'manager', 'finance')
);

drop policy asset_register_insert on asset_register;
create policy asset_register_insert on asset_register for insert with check (
  current_user_role() in ('superadmin', 'manager', 'warehouse', 'finance')
);

drop policy asset_register_update on asset_register;
create policy asset_register_update on asset_register for update
  using (current_user_role() in ('superadmin', 'manager', 'finance'))
  with check (current_user_role() in ('superadmin', 'manager', 'finance'));

-- asset_register_delete is unchanged: superadmin/manager only.
