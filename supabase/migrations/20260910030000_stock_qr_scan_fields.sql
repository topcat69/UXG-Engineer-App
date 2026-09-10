-- QR-scan goods-in: the label QR on a lot of commercial AV kit (screens,
-- players) encodes "MODEL,SERIAL,MAC,MAC,MAC,HW_ID" (comma-separated,
-- confirmed against a real Sony display label) — this adds the two new
-- fields that payload carries and the kiosk's Add Stock Item form didn't
-- have anywhere to put: a free-text Description, and the unit's H/W ID.
--
-- description also goes on the Stock Catalog (stock_models), not just
-- stock_items: scanning a model already in the catalog auto-fills
-- Manufacturer/Model/Description from there (plus Serial/H-W ID from the
-- scan itself); scanning one that isn't yet auto-registers it into the
-- catalog so the next scan of that same model is instant too.
alter table stock_models add column description text;
alter table stock_items add column description text;
alter table stock_items add column hw_id text;
