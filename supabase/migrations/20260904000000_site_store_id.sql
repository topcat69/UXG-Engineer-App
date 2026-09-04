-- The customer's own internal reference for a site (e.g. a retailer's
-- internal store number), distinct from this app's own site name/address —
-- used to cross-reference with the customer's own systems when scheduling
-- or reporting on a job. Optional and free-text since format varies per
-- customer.
alter table sites add column store_id text;
