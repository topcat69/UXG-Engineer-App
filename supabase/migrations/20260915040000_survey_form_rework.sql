-- Replaces survey_forms' thin, never-actually-used shape with the real
-- Site Survey Form: a header + once-per-visit sections on survey_forms
-- itself, a repeatable survey_screens row per physical screen (sections 2
-- through 6 + the per-screen half of network), and a repeatable
-- survey_actions row per follow-up item (section 14). See the scoped
-- design (survey-form-scope.html) for the section-by-section mapping.
--
-- No backfill: confirmed with the business that nothing real has ever
-- been written to survey_forms's old columns (mounting_surface,
-- power_available, network_available, access_restrictions,
-- measurements) — anything there is test data, safe to drop outright.
alter table survey_forms
  drop column if exists mounting_surface,
  drop column if exists power_available,
  drop column if exists network_available,
  drop column if exists access_restrictions,
  drop column if exists measurements;

alter table survey_forms
  add column project text,
  add column surveyor text,
  add column survey_date date,
  add column site_contact_name text,
  add column site_contact_role text,
  add column site_contact_phone text,
  add column screen_count int,
  -- 1. Access & Logistics
  add column access_notes text,
  add column delivery_notes text,
  add column working_hours text,
  add column site_induction_required boolean default false,
  add column ppe_required text,
  add column escort_required boolean default false,
  -- 7. Network & Connectivity (site-level half; per-screen half lives on survey_screens)
  add column it_contact_name text,
  add column network_summary_notes text,
  -- 8. Cabling & Containment
  add column cable_route_notes text,
  add column containment_present text,
  add column floor_boxes_required boolean default false,
  add column cable_concealment text,
  add column firestopping_notes text,
  -- 9. Environmental
  add column ventilation_adequate boolean,
  add column enclosure_required boolean,
  add column direct_sunlight boolean,
  add column temp_humidity_ok boolean,
  -- 12. Health, Safety & Compliance
  add column working_at_height text,
  add column asbestos_checked boolean default false,
  add column rams_required boolean default false,
  add column dda_compliant boolean,
  add column other_trades_notes text,
  -- 13. Survey Record
  add column floor_plan_captured boolean default false,
  add column measurements_checked boolean default false,
  -- 14. free text (the structured follow-up rows live in survey_actions)
  add column outstanding_items text;

create table survey_screens (
  id uuid primary key default gen_random_uuid(),
  survey_form_id uuid not null references survey_forms(id) on delete cascade,
  position integer not null default 0,
  screen_label text,
  -- 2. Screen Location
  location text,
  environment text,
  mounting_height text,
  photo_taken boolean default false,
  position_agreed boolean default false,
  -- 3. Display Requirements
  screen_size text,
  orientation text,
  commercial_grade_required boolean,
  brightness_tier text,
  glare_assessed boolean default false,
  reuse_existing_display boolean,
  existing_display_detail text,
  -- 4. Media Player
  player_required boolean,
  player_location text,
  ventilation_ok boolean,
  shared_power_socket boolean,
  hdmi_run_length text,
  maintenance_access_ok boolean,
  reuse_existing_player boolean,
  existing_player_detail text,
  -- 5. Mounting & Fixings
  mount_surface text,
  stud_checked boolean,
  estimated_weight numeric,
  fixing_type text,
  existing_bracket_reusable boolean,
  overhead_obstructions boolean,
  tamper_proof_required boolean,
  -- 6. Power
  socket_count integer,
  socket_sufficient boolean,
  distance_to_socket text,
  new_spur_required boolean,
  switched_with_lighting boolean,
  isolation_notes text,
  -- 7. Network & Connectivity (per-screen half)
  connection_method text,
  live_data_point boolean,
  wifi_signal_checked boolean,
  wifi_security text,
  wifi_ssid text,
  ip_mode text,
  vlan text,
  -- 11. Fleet / Asset Capture — feeds the office review's derived summary
  -- table directly from these columns; never entered separately.
  display_make_model text,
  player_make_model text,
  serial_number text,
  mac_address text,
  created_at timestamptz default now()
);
create index on survey_screens (survey_form_id);

-- 14. Actions & Follow-up — tied to the survey as a whole, not any one screen.
create table survey_actions (
  id uuid primary key default gen_random_uuid(),
  survey_form_id uuid not null references survey_forms(id) on delete cascade,
  position integer not null default 0,
  action text not null,
  owner text,
  due_date date,
  done boolean default false,
  created_at timestamptz default now()
);
create index on survey_actions (survey_form_id);

alter table survey_screens enable row level security;
alter table survey_actions enable row level security;

-- Same shape as survey_forms' own policies (see 20260103000000_rls.sql and
-- the write-lock extension in 20260203000000_revisit_status_rls.sql),
-- just one join further out through survey_forms to reach the job.
create policy survey_screens_select on survey_screens for select using (
  exists (
    select 1 from survey_forms
    join jobs on jobs.id = survey_forms.job_id
    where survey_forms.id = survey_screens.survey_form_id
  )
);
create policy survey_screens_insert on survey_screens for insert with check (
  exists (
    select 1 from survey_forms
    join jobs on jobs.id = survey_forms.job_id
    where survey_forms.id = survey_screens.survey_form_id
    and (
      current_user_role() in ('superadmin','manager')
      or (
        jobs.assigned_to = auth.uid()
        and jobs.status not in ('submitted','under_review','approved','closed','revisit')
      )
    )
  )
);
create policy survey_screens_update on survey_screens for update using (
  exists (
    select 1 from survey_forms
    join jobs on jobs.id = survey_forms.job_id
    where survey_forms.id = survey_screens.survey_form_id
    and (
      current_user_role() in ('superadmin','manager')
      or (
        jobs.assigned_to = auth.uid()
        and jobs.status not in ('submitted','under_review','approved','closed','revisit')
      )
    )
  )
);
create policy survey_screens_delete on survey_screens for delete using (
  exists (
    select 1 from survey_forms
    join jobs on jobs.id = survey_forms.job_id
    where survey_forms.id = survey_screens.survey_form_id
    and (
      current_user_role() in ('superadmin','manager')
      or (
        jobs.assigned_to = auth.uid()
        and jobs.status not in ('submitted','under_review','approved','closed','revisit')
      )
    )
  )
);

create policy survey_actions_select on survey_actions for select using (
  exists (
    select 1 from survey_forms
    join jobs on jobs.id = survey_forms.job_id
    where survey_forms.id = survey_actions.survey_form_id
  )
);
create policy survey_actions_insert on survey_actions for insert with check (
  exists (
    select 1 from survey_forms
    join jobs on jobs.id = survey_forms.job_id
    where survey_forms.id = survey_actions.survey_form_id
    and (
      current_user_role() in ('superadmin','manager')
      or (
        jobs.assigned_to = auth.uid()
        and jobs.status not in ('submitted','under_review','approved','closed','revisit')
      )
    )
  )
);
create policy survey_actions_update on survey_actions for update using (
  exists (
    select 1 from survey_forms
    join jobs on jobs.id = survey_forms.job_id
    where survey_forms.id = survey_actions.survey_form_id
    and (
      current_user_role() in ('superadmin','manager')
      or (
        jobs.assigned_to = auth.uid()
        and jobs.status not in ('submitted','under_review','approved','closed','revisit')
      )
    )
  )
);
create policy survey_actions_delete on survey_actions for delete using (
  exists (
    select 1 from survey_forms
    join jobs on jobs.id = survey_forms.job_id
    where survey_forms.id = survey_actions.survey_form_id
    and (
      current_user_role() in ('superadmin','manager')
      or (
        jobs.assigned_to = auth.uid()
        and jobs.status not in ('submitted','under_review','approved','closed','revisit')
      )
    )
  )
);
