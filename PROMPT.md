# OPOC — Field Service & Job Management Platform

You are building OPOC: a project coordination and field data collection platform.
Engineers complete installation and service jobs at customer sites, capturing
structured forms, photos, signatures and GPS evidence, frequently with no mobile
signal. A small office team schedules the work and reviews it.

## Scale and shape — read this before choosing any architecture
- **~8 users total.** Roughly 2 office, 6 field. This is a small internal tool.
- **But not small data.** A single rollout is 500+ sites with 6–15 photos each:
  tens of thousands of media rows and 10–50GB of files.
- Therefore: do NOT build multi-tenancy, org hierarchies, a plugin system, an
  admin-configurable form builder, or a microservice split. Do build properly
  indexed queries, real offline sync, and sane media handling.
- Optimise for a codebase one person can hold in their head and change quickly.
  Every abstraction must earn its place. When in doubt, write the boring version.

## Distribution — no app stores
Ship as an **installable PWA**. Users open a link and add it to their home screen.
No Play Store, no App Store, no review process. It must:
- Have a valid web app manifest with maskable icons and `display: standalone`
- Register a service worker that caches the shell and enables full offline use
- Show a custom install prompt on Android (`beforeinstallprompt`) and a short
  illustrated instruction card on iOS (Share → Add to Home Screen), since Safari
  has no install event
- Work correctly when launched from the home screen icon, offline, cold

## iOS constraints — build defensively for these
- Safari does NOT support the Background Sync API. Never rely on it. Use it as a
  progressive enhancement on Android, with a foreground retry loop (on app open,
  on visibilitychange, on network reconnect, and on a timer while open) as the
  baseline that works everywhere.
- Safari evicts script-writable storage under pressure. On first run, call
  `navigator.storage.persist()`. It only succeeds with notification permission
  granted, so request notification permission during onboarding and explain why
  in plain language ("this stops your phone deleting unsent job data").
- Show a persistent, obvious outbox indicator whenever unsent data exists:
  count, total size, and last attempt. Never let a user believe work is saved
  when it is sitting in a queue.
- Check `navigator.storage.estimate()` and warn the user before the outbox grows
  large enough to risk eviction.

## Stack
- **Next.js (App Router) + TypeScript + Tailwind + shadcn/ui** — one app, serving
  both the field UI and the office UI from the same codebase with different routes
- **Supabase** — Postgres, Row Level Security, Auth (magic link), Storage, Realtime
- **Dexie.js (IndexedDB)** for the offline store and the outbox
- **Serwist** (or a hand-rolled service worker — justify whichever you pick) for PWA caching
- **browser-image-compression** for client-side image resizing
- **signature_pad** for signature capture
- **BarcodeDetector API** where available, **@zxing/library** as fallback, for serial scanning
- **Recharts** for dashboards
- **googleapis** for Calendar and Gmail
- **Resend** for transactional email
- **Vitest** for logic, **Playwright** for E2E including offline scenarios

## Non-negotiable constraints
1. **Offline-first for the field routes.** Open an assigned job, complete a form,
   capture photos, sign, check in and out, submit — all with the device in airplane
   mode, then sync cleanly on reconnect. This is the acceptance criterion that
   matters more than any other.
2. **RLS on every table.** An engineer reads only jobs assigned to them. Enforce in
   the database, never in the UI. Write tests that prove it, including deliberately
   failing cases.
3. **Media metadata captured at capture time**: latitude, longitude, accuracy,
   device timestamp, server timestamp, SHA-256 hash. Store both clocks — they
   diverge and the difference is evidentially useful.
4. **Media must never block submission.** Submit marks the job `submitted` with a
   `media_pending` count that drains asynchronously.
5. **Status changes are append-only rows** in `status_events`, never overwritten
   fields. Each records user, timestamp, lat/lng, reason.
6. **GPS only at check-in, check-out and media capture.** No background tracking,
   ever. This is a legal and industrial-relations line, not a preference.

## Schema

This schema deliberately mirrors an existing Google AppSheet app so data can be
migrated in. Do not rename columns for elegance.

```sql
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
```

## RLS policies

- `admin` and `manager`: full read on everything; write per role.
- `engineer`: read `jobs` where `assigned_to = auth.uid()` AND
  `scheduled_start between now() - interval '30 days' and now() + interval '14 days'`.
  The date window is a performance requirement, not just security — it bounds
  what syncs to the phone.
- Child tables (`install_forms`, `survey_forms`, `media_assets`, `signatures`,
  `status_events`): readable/writable where the parent job is visible.
- `install_forms` and `survey_forms`: engineer UPDATE allowed only while the
  parent job status is not in ('submitted','under_review','approved','closed').
  Completed evidence must not be silently editable.
- `share_links`: no authenticated access needed; served by a public route that
  looks up the token server-side and returns a redacted job view.

## Job lifecycle

```
draft → scheduled → dispatched → accepted → travelling → on_site
      → in_progress → submitted → under_review → approved → closed
```
Rejection at `under_review` sets `qa_status = 'rejected'` and offers creation of a
revisit job linked via `parent_job_id`. Any state can move to `on_hold` (mandatory
reason) or `cancelled` (mandatory reason, manager only).

## Forms

Fixed columns per job type, rendered from a typed config object per form —
NOT a database-driven form builder. Conditional logic is plain TypeScript
predicates over the current form values.

`install_forms` field behaviour:
- `wifi_signal` shown and required only when `network_type = 'wifi'`
- `issue_detail` shown and required only when `issues_found = true`
- Six required photo slots: `photo_before`, `photo_screen_mounted`,
  `photo_player_installed`, `photo_cable_management`, `photo_content_on_screen`,
  `photo_wide_shot`
- Client signature required before submit
- Serial fields offer barcode/QR scan with manual entry fallback

## Media capture rules
- Use `<input type="file" accept="image/*" capture="environment">` for camera
  capture. Note that `capture` is a hint the user can sometimes bypass — do not
  treat it as proof of provenance. Provenance comes from the GPS, both timestamps
  and the hash stored server-side.
- Compress client-side to ~1600px long edge, ~0.8 quality, before it enters the
  outbox. Storing full-resolution originals in IndexedDB will trigger eviction.
- Video: 60s and 720p cap, and only where a form slot explicitly requests it.
- Upload direct to Supabase Storage with signed URLs. Resumable, exponential
  backoff, WiFi-preferred toggle the user can override.

## Google Workspace integration

**Calendar** — one-way, OPOC → Calendar. Never accept edits back; read free/busy
only, for conflict warnings.
- Service account with domain-wide delegation for in-domain users
- On schedule/reschedule: if `calendar_event_id` is null, create the event and
  persist the id; if it is set, PATCH that event. Missing this branch produces
  duplicate events on every reschedule and is the most common failure of this
  integration.
- On cancel: delete the event, null the id
- Title `{job_number} — {site.name}`; **location set to the full site address** so
  the calendar entry is tap-to-navigate in Google Maps; description carries access
  notes, site contact and a deep link to the job
- Publish a per-engineer ICS feed at a signed URL for anyone outside the domain

**Email** — Resend for all transactional mail:
- job assigned · day-before schedule · submitted (to manager) · approved (to
  client, with completion PDF) · weekly project summary
- Set a stable `References` header derived from the job id and store
  `email_thread_id`, so all correspondence about a job threads together

## Build phases — stop for review after each

### Phase 0 — Foundation
Next.js + TypeScript + Tailwind + shadcn, Supabase local dev, migrations
directory, generated DB types, CI running typecheck/lint/test.
**Done when:** app boots, types generate from schema, `pnpm test` passes.

### Phase 1 — Schema, auth, RLS
Full schema above. Magic-link auth. All RLS policies. Seed: 3 users covering
each role, 1 project, 40 sites, 60 jobs across all statuses, 20 completed
install forms with media rows.
**Done when:** an automated test proves each role reads exactly the rows it
should, including at least one deliberately failing assertion per role.

### Phase 2 — Office UI
Job list with filter/search/bulk-select. Bulk assign and bulk schedule (essential
— 500 sites cannot be scheduled one at a time). Job detail with status timeline,
form data, media gallery, map, issues. Week-view scheduler with per-engineer
lanes, drag to reschedule, conflict warnings. CSV import for sites and bulk job
generation. QA queue with approve/reject.
**Done when:** a manager can import 50 sites from CSV, generate 50 jobs, bulk
assign and schedule them in under five minutes.

### Phase 3 — Field PWA, offline
Manifest, service worker, install prompt (Android) and instruction card (iOS).
Persistent storage request. Dexie schema mirroring the server tables needed
offline. Sync-down of assigned jobs plus sites for the date window. Outbox with
durable mutation queue and media queue. My Jobs list, job detail, check-in with
geofence variance, form renderer with conditional logic, 15-second autosave
surviving force-quit, camera capture with compression, barcode scan, signature,
check-out and submit. Visible outbox screen with counts, sizes and retry.
**Done when:** a full airplane-mode run — open job, complete form, capture six
photos, sign, submit — succeeds, survives a force-quit mid-form, and syncs
correctly on reconnect. Write this as an automated Playwright test with the
network disabled, and also test it by hand on a real mid-range Android phone.

### Phase 4 — Calendar and email
Everything in the Google Workspace section above, plus the ICS feed and
tokenised share links (`/share/{token}`) showing status, completion report and
approved photos only — never internal notes, other jobs or costs.
**Done when:** scheduling a job creates a correctly-located calendar event,
rescheduling updates that same event rather than creating a second, and a share
link opens on a phone with no account and leaks nothing beyond that job.

### Phase 5 — Issues, revisits, reports
Raise issue manually or automatically from a `fail` answer. Create Revisit
cloning site/project/type with `parent_job_id` set. Completion PDF: job details,
form answers, photos with GPS and timestamp overlays, signatures, hash manifest.
**Done when:** a failed check produces an issue, a linked revisit job, and a PDF
that would stand up as evidence.

### Phase 6 — Dashboard
Realtime status counters via Supabase Realtime. First-time fix rate, completed
vs scheduled, average time on site, revisit rate by cause, open issues by age,
engineer workload. Every chart drills through to a filtered job list; every list
exports CSV.
**Done when:** a status change on a phone appears on the dashboard within two
seconds with no refresh.

### Phase 7 — Migration and hardening
CSV importers matching the AppSheet export shape for every table. A script that
copies media from a Google Drive folder tree into Supabase Storage and creates
`media_assets` rows with metadata preserved. Storage lifecycle rules. Sentry.
Load test at 500 jobs and 10,000 media rows.
**Done when:** a full AppSheet export imports cleanly with media intact and
job history preserved.

## Working rules
- Stop after each phase. Summarise what was built, list every assumption you
  made, and wait for review.
- If a requirement is ambiguous, ask — but propose your preferred answer with a
  reason, so I can just say yes.
- Tests as you go, not at the end. Offline sync and RLS get tests first.
- Keep `DECISIONS.md` recording every architectural choice and why.
- No mocks or stubs in anything you mark complete.
- Prefer the boring solution. This codebase serves eight people and needs to be
  changeable by one person on a Friday afternoon.
