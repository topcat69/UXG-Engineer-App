-- A safe, narrow public view over asset_register for Service Desk's sync
-- script to read (scripts/sync-from-engineer-app.ts there, anon key
-- only — the real table stays locked to superadmin/manager/finance, see
-- 20260914040000_finance_asset_register_access.sql). Exposes only what
-- a ticket needs to cross-check against a reported fault — what's
-- actually on site, and its status — never purchase cost, warranty,
-- supplier, or PO/invoice data.
--
-- Deliberately not security_invoker (Postgres' view default): the view
-- runs with its owning role's privileges against asset_register, which
-- is what lets an anon-key read through this view succeed at all
-- despite asset_register's own RLS being locked down — the view's own
-- column list is the only thing an anon/authenticated caller ever sees,
-- same "safe subset" pattern as any other Postgres RLS-bypass view.
create view site_asset_summary as
select id, site_id, manufacturer, model, serial_number, status
from asset_register
where site_id is not null;

grant select on site_asset_summary to anon, authenticated;
