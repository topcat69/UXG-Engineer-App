-- Phase 4: the "approved" email goes to the client, but nothing in the
-- schema had a client email address anywhere — sites has contact_name and
-- contact_phone but no contact_email, and projects only has client_name.
-- A site's on-site contact is the natural recipient for that site's
-- completion report, so this adds the missing column there rather than
-- inventing a new client-contacts table this app doesn't otherwise need.
alter table sites add column contact_email text;
