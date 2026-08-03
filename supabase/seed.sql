-- Phase 1 seed data. Applied automatically by `supabase db reset`.
--
-- 3 users covering each role, 1 project, 40 sites, 60 jobs spread across
-- every job_status, and 20 completed install_forms with media rows — per
-- PROMPT.md's Phase 1 "Done when" criteria. Deliberately not exhaustive
-- beyond that (e.g. seeded media only covers a few of the six photo slots):
-- this seed exists to exercise RLS and joins, not to be a realistic dataset.

-- ---------------------------------------------------------------------------
-- Users: one admin, one manager, one engineer. Passwordless (magic-link)
-- accounts — the password hash below is never used to sign in; tests and
-- the app authenticate via Supabase's OTP/magic-link flow instead.
-- ---------------------------------------------------------------------------
do $$
declare
  admin_id uuid := '00000000-0000-0000-0000-000000000001';
  manager_id uuid := '00000000-0000-0000-0000-000000000002';
  engineer_id uuid := '00000000-0000-0000-0000-000000000003';
  project_id uuid := gen_random_uuid();
  site_ids uuid[];
  site_id uuid;
  job_id uuid;
  statuses job_status[] := array[
    'draft','scheduled','dispatched','accepted','travelling','on_site',
    'in_progress','submitted','under_review','approved','closed',
    'on_hold','cancelled'
  ];
  completed_statuses job_status[] := array['submitted','under_review','approved','closed'];
  s job_status;
  i int;
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
    is_super_admin, confirmation_token, email_change, email_change_token_new, recovery_token
  ) values
    ('00000000-0000-0000-0000-000000000000', admin_id, 'authenticated', 'authenticated',
     'admin@opoc.test', crypt(gen_random_uuid()::text, gen_salt('bf')), now(), now(), now(),
     '{"provider":"email","providers":["email"]}', '{}', false, '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', manager_id, 'authenticated', 'authenticated',
     'manager@opoc.test', crypt(gen_random_uuid()::text, gen_salt('bf')), now(), now(), now(),
     '{"provider":"email","providers":["email"]}', '{}', false, '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', engineer_id, 'authenticated', 'authenticated',
     'engineer@opoc.test', crypt(gen_random_uuid()::text, gen_salt('bf')), now(), now(), now(),
     '{"provider":"email","providers":["email"]}', '{}', false, '', '', '', '');

  insert into auth.identities (
    id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values
    (gen_random_uuid(), admin_id::text, admin_id,
     jsonb_build_object('sub', admin_id::text, 'email', 'admin@opoc.test'), 'email', now(), now(), now()),
    (gen_random_uuid(), manager_id::text, manager_id,
     jsonb_build_object('sub', manager_id::text, 'email', 'manager@opoc.test'), 'email', now(), now(), now()),
    (gen_random_uuid(), engineer_id::text, engineer_id,
     jsonb_build_object('sub', engineer_id::text, 'email', 'engineer@opoc.test'), 'email', now(), now(), now());

  -- The on_auth_user_created trigger already inserted a default 'engineer'
  -- row for each of these from the auth.users insert above; upsert the real
  -- names/roles over it.
  insert into users (id, email, name, role, active) values
    (admin_id, 'admin@opoc.test', 'Ada Admin', 'admin', true),
    (manager_id, 'manager@opoc.test', 'Mo Manager', 'manager', true),
    (engineer_id, 'engineer@opoc.test', 'Eve Engineer', 'engineer', true)
  on conflict (id) do update set name = excluded.name, role = excluded.role, active = excluded.active;

  -- 1 project
  insert into projects (id, name, client_name, start_date, status)
  values (project_id, 'Signage Rollout — Phase 1', 'Acme Retail', current_date - 60, 'active');

  -- 40 sites
  with ins as (
    insert into sites (name, address_line1, town, postcode, latitude, longitude, organisation)
    select
      'Site ' || n,
      n || ' High Street',
      'Testford',
      'TE' || n || ' 1AA',
      51.5 + (n * 0.001),
      -0.1 + (n * 0.001),
      'Acme Retail'
    from generate_series(1, 40) as n
    returning id
  )
  select array_agg(id) into site_ids from ins;

  -- 60 jobs. The first 20 are forced into a "completed" status (submitted /
  -- under_review / approved / closed) and get an install_forms + media_assets
  -- row each, per the Phase 1 seed spec. The remaining 40 cycle through every
  -- status so the seed still exercises the full lifecycle. Jobs are spread
  -- across assigned-in-window / assigned-out-of-window / unassigned so the
  -- engineer RLS date filter can be proven to both include and exclude.
  for i in 1..60 loop
    if i <= 20 then
      s := completed_statuses[((i - 1) % array_length(completed_statuses, 1)) + 1];
    else
      s := statuses[((i - 21) % array_length(statuses, 1)) + 1];
    end if;
    site_id := site_ids[((i - 1) % array_length(site_ids, 1)) + 1];

    insert into jobs (
      id, job_number, project_id, site_id, job_type, status, assigned_to,
      scheduled_start, scheduled_end
    ) values (
      gen_random_uuid(),
      'OPOC-2026-' || lpad(i::text, 4, '0'),
      project_id,
      site_id,
      'install',
      s,
      case
        when i % 3 = 0 then engineer_id       -- in-window, engineer should see these
        when i % 3 = 1 then null              -- unassigned, engineer should NOT see these
        else engineer_id                       -- assigned but out of window below
      end,
      case
        when i % 3 = 2 then now() + interval '45 days'  -- outside the +14 day window
        else now() - (i || ' hours')::interval
      end,
      now() + interval '2 hours'
    ) returning id into job_id;

    -- 20 completed install_forms with a few media rows each
    if i <= 20 then
      insert into install_forms (
        job_id, player_serial, screen_serial, mount_type, power_source, network_type,
        wifi_signal, player_boot_test, content_displaying, issues_found, client_name, submitted_at
      ) values (
        job_id, 'PLR-' || i, 'SCR-' || i, 'Wall', 'Existing socket', 'wifi',
        'Good', 'pass', 'pass', false, 'Site Contact ' || i, now()
      );

      insert into media_assets (job_id, slot, storage_path, media_type, bytes, mime, captured_at, uploaded_at, captured_by)
      values
        (job_id, 'photo_before', 'jobs/' || job_id || '/photo_before.jpg', 'image', 512000, 'image/jpeg', now(), now(), engineer_id),
        (job_id, 'photo_wide_shot', 'jobs/' || job_id || '/photo_wide_shot.jpg', 'image', 612000, 'image/jpeg', now(), now(), engineer_id),
        (job_id, 'photo_content_on_screen', 'jobs/' || job_id || '/photo_content_on_screen.jpg', 'image', 400000, 'image/jpeg', now(), now(), engineer_id);
    end if;
  end loop;
end $$;
