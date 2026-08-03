-- Phase 1: full schema. Mirrors the AppSheet build's tables and column names
-- so a later data migration is a CSV import, not a redesign. Do not rename
-- columns for elegance.

create type user_role as enum ('admin','manager','engineer');
create type job_status as enum (
  'draft','scheduled','dispatched','accepted','travelling','on_site',
  'in_progress','submitted','under_review','approved','closed',
  'on_hold','cancelled'
);
create type qa_status as enum ('pending','approved','rejected');
create type pass_fail as enum ('pass','fail','na');

create table users (
  id uuid primary key references auth.users(id),
  email text unique not null,
  name text not null,
  role user_role not null default 'engineer',
  company text,
  phone text,
  active boolean not null default true,
  max_jobs_per_day int default 4,
  created_at timestamptz default now()
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  client_name text,
  start_date date,
  end_date date,
  status text default 'active',
  created_at timestamptz default now()
);

create table sites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address_line1 text, address_line2 text, town text, postcode text,
  latitude double precision, longitude double precision,
  access_notes text,
  contact_name text, contact_phone text,
  organisation text,
  created_at timestamptz default now()
);

create table assets (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references sites(id),
  serial text, model text, asset_type text,
  install_date date, warranty_end date,
  created_at timestamptz default now()
);

create table jobs (
  id uuid primary key default gen_random_uuid(),
  job_number text unique not null,
  project_id uuid references projects(id),
  site_id uuid references sites(id) not null,
  job_type text not null,
  status job_status not null default 'draft',
  priority text default 'P3',
  assigned_to uuid references users(id),
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  actual_start timestamptz,
  actual_end timestamptz,
  check_in_lat double precision,
  check_in_lng double precision,
  geofence_variance_m numeric,
  description text,
  parent_job_id uuid references jobs(id),
  source_issue_id uuid,
  qa_status qa_status default 'pending',
  qa_notes text,
  calendar_event_id text,
  email_thread_id text,
  media_pending int default 0,
  completion_pdf_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index on jobs (status);
create index on jobs (assigned_to, scheduled_start);
create index on jobs (site_id);
create index on jobs (project_id);

create function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger jobs_set_updated_at
  before update on jobs
  for each row execute function set_updated_at();

-- One table per job type. Add a table when a job type is added.
create table install_forms (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references jobs(id) on delete cascade unique,
  player_serial text,
  screen_serial text,
  mount_type text,
  power_source text,
  network_type text,
  wifi_signal text,
  player_boot_test pass_fail,
  content_displaying pass_fail,
  issues_found boolean default false,
  issue_detail text,
  engineer_notes text,
  client_name text,
  submitted_at timestamptz,
  created_at timestamptz default now()
);

create table survey_forms (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references jobs(id) on delete cascade unique,
  mounting_surface text,
  power_available boolean,
  network_available boolean,
  access_restrictions text,
  measurements text,
  engineer_notes text,
  submitted_at timestamptz,
  created_at timestamptz default now()
);

create table media_assets (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references jobs(id) on delete cascade,
  slot text not null,          -- e.g. 'photo_before', 'photo_wide_shot'
  storage_path text not null,
  thumb_path text,
  media_type text not null,    -- 'image' | 'video'
  bytes bigint,
  mime text,
  captured_at timestamptz not null,   -- device clock
  uploaded_at timestamptz,            -- server clock
  latitude double precision,
  longitude double precision,
  accuracy_m numeric,
  sha256 text,
  captured_by uuid references users(id),
  caption text
);
create index on media_assets (job_id);

create table signatures (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references jobs(id) on delete cascade,
  signer_name text not null,
  signer_role text not null,
  storage_path text not null,
  signed_at timestamptz not null,
  latitude double precision,
  longitude double precision
);

create table issues (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references jobs(id),
  site_id uuid references sites(id),
  raised_by uuid references users(id),
  severity text not null,
  category text,
  description text not null,
  blocks_completion boolean default false,
  status text default 'open',
  resolved_at timestamptz,
  revisit_job_id uuid references jobs(id),
  created_at timestamptz default now()
);

create table status_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references jobs(id) on delete cascade,
  from_status job_status,
  to_status job_status not null,
  user_id uuid references users(id),
  latitude double precision,
  longitude double precision,
  reason text,
  occurred_at timestamptz not null default now()
);
create index on status_events (job_id, occurred_at);

create table share_links (
  token text primary key,
  job_id uuid references jobs(id),
  project_id uuid references projects(id),
  expires_at timestamptz not null,
  revoked boolean default false,
  created_by uuid references users(id),
  created_at timestamptz default now()
);
