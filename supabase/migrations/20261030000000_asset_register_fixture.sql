-- "Fixture" — a free-text label for where/what this asset actually is at
-- the site (e.g. "Reception screen", "Till 3"), distinct from
-- manufacturer/model/serial. Lets someone picking "which asset is
-- affected" when logging a Service Desk call tell apart several similar
-- units at one site without needing to know a serial number. Optional,
-- same "picklist is convenience, not a relationship" trust level as the
-- rest of this table — no backfill for existing rows.
alter table asset_register add column fixture text;

-- Exposed through to Service Desk's sync alongside the other fields this
-- view already carries — see that view's own comment for why it's a
-- narrow subset rather than the real table.
drop view site_asset_summary;
create view site_asset_summary as
select id, site_id, manufacturer, model, serial_number, status, fixture
from asset_register
where site_id is not null;

grant select on site_asset_summary to anon, authenticated;
