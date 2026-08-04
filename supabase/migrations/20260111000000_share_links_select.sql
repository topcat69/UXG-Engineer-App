-- Phase 4: share_links had insert/update policies for admin/manager but no
-- select policy at all — deliberate for the *public* /share/{token} route,
-- which reads via the service-role client and was never meant to need
-- RLS. But the office UI's own "create/manage share links for this job"
-- panel is admin/manager-gated already (requireOfficeUser) and runs on the
-- normal RLS-scoped client like everything else in that UI, so it needs a
-- read path too. Scoped the same way every other admin/manager policy in
-- this app is, rather than reaching for the service-role client from an
-- authenticated context just to avoid writing one more policy.
create policy share_links_select on share_links for select using (
  current_user_role() in ('admin','manager')
);
