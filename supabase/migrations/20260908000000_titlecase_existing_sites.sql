-- One-off cleanup: sites imported (or entered) with ALL CAPS name/address
-- data -- e.g. "ABERDEEN" -- read poorly across the office UI, job emails,
-- and completion PDFs. Every new site write (manual create/edit and CSV
-- import) already title-cases these same fields going forward (see
-- titleCase() in lib/format/text.ts); this backfills whatever already
-- exists in the table so old and newly-imported sites read the same way.
--
-- initcap() capitalizes after any non-alphanumeric boundary (space,
-- hyphen, apostrophe) -- same class of algorithm as the TS titleCase()
-- helper, so this migration and every future write agree on the result.
-- Deliberately excludes postcode (must stay uppercase, e.g. "AB10 1AA")
-- and contact_name/access_notes (free text office staff write themselves,
-- not imported data, so not something this should silently rewrite).
update sites set
  name = initcap(name),
  address_line1 = initcap(address_line1),
  address_line2 = initcap(address_line2),
  town = initcap(town)
where name <> initcap(name)
   or address_line1 <> initcap(address_line1)
   or address_line2 <> initcap(address_line2)
   or town <> initcap(town);
