-- Reverses the "a project can span many clients" design from
-- 20260116000000_clients.sql: management wants the client at the top of the
-- tree, with Project and Site both hanging off it directly (Site already
-- did — see sites.client_id — this closes the other half). Going forward a
-- project belongs to exactly one client; a client's sites stay reusable
-- across all of that client's projects, unchanged.
alter table projects add column client_id uuid references clients(id);
create index on projects (client_id);

-- Best-effort backfill: only for a project where every existing job on it
-- already resolves (via its site) to a single client -- that's the common
-- case in practice. A project whose jobs already span more than one client
-- doesn't fit the new model and is deliberately left null rather than
-- guessing a "primary" client and silently misfiling the rest -- the
-- Projects page now requires a client to be set, so any left null surface
-- there for an admin to resolve by hand.
with project_client_counts as (
  select j.project_id, s.client_id
  from jobs j
  join sites s on s.id = j.site_id
  where j.project_id is not null
  group by j.project_id, s.client_id
),
unambiguous as (
  select project_id, min(client_id) as client_id
  from project_client_counts
  group by project_id
  having count(*) = 1
)
update projects p
set client_id = u.client_id
from unambiguous u
where u.project_id = p.id;

-- Not NOT NULL: a project with no jobs yet, or one whose existing jobs
-- span multiple clients, has no safe value to backfill. Enforced as
-- required at the app layer (createProject/updateProject) for everything
-- going forward instead; a future migration can add the NOT NULL
-- constraint once every existing project has been assigned one by hand.
