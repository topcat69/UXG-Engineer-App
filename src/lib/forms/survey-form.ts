// Fixed columns rendered from this typed config — NOT a database-driven form
// builder, per PROMPT.md's Forms section, same convention as install-form.ts
// and job-form.ts. Covers survey_forms' own once-per-survey fields; the
// repeating survey_screens/survey_actions rows are edited directly against
// their Dexie/DB row shape (see survey-form-section.tsx) rather than through
// a matching *Values type — thirty-odd fields on a row that's edited one row
// at a time doesn't need the same "convert nulls to controlled-input
// defaults" treatment a single big per-job row does.

import type { Database } from "@/lib/supabase/database.types";

export type SurveyFormRow = Database["public"]["Tables"]["survey_forms"]["Row"];
export type SurveyScreenRow = Database["public"]["Tables"]["survey_screens"]["Row"];
export type SurveyActionRow = Database["public"]["Tables"]["survey_actions"]["Row"];

export type SurveyFormValues = {
  project: string;
  surveyor: string;
  survey_date: string;
  site_contact_name: string;
  site_contact_role: string;
  site_contact_phone: string;
  // 1. Access & Logistics
  access_notes: string;
  delivery_notes: string;
  working_hours: string;
  site_induction_required: boolean;
  ppe_required: string;
  escort_required: boolean;
  // 7. Network & Connectivity (site-level half)
  it_contact_name: string;
  network_summary_notes: string;
  // 8. Cabling & Containment
  cable_route_notes: string;
  containment_present: string;
  floor_boxes_required: boolean;
  cable_concealment: string;
  firestopping_notes: string;
  // 9. Environmental
  ventilation_adequate: boolean;
  enclosure_required: boolean;
  direct_sunlight: boolean;
  temp_humidity_ok: boolean;
  // 12. Health, Safety & Compliance
  working_at_height: string;
  asbestos_checked: boolean;
  rams_required: boolean;
  dda_compliant: boolean;
  other_trades_notes: string;
  // 13. Survey Record
  floor_plan_captured: boolean;
  measurements_checked: boolean;
  // 14. free text
  outstanding_items: string;
  engineer_notes: string;
};

export const EMPTY_SURVEY_FORM: SurveyFormValues = {
  project: "",
  surveyor: "",
  survey_date: "",
  site_contact_name: "",
  site_contact_role: "",
  site_contact_phone: "",
  access_notes: "",
  delivery_notes: "",
  working_hours: "",
  site_induction_required: false,
  ppe_required: "",
  escort_required: false,
  it_contact_name: "",
  network_summary_notes: "",
  cable_route_notes: "",
  containment_present: "",
  floor_boxes_required: false,
  cable_concealment: "",
  firestopping_notes: "",
  ventilation_adequate: false,
  enclosure_required: false,
  direct_sunlight: false,
  temp_humidity_ok: false,
  working_at_height: "",
  asbestos_checked: false,
  rams_required: false,
  dda_compliant: false,
  other_trades_notes: "",
  floor_plan_captured: false,
  measurements_checked: false,
  outstanding_items: "",
  engineer_notes: "",
};

export function surveyFormRowToValues(row: SurveyFormRow | undefined): SurveyFormValues {
  if (!row) return EMPTY_SURVEY_FORM;
  return {
    project: row.project ?? "",
    surveyor: row.surveyor ?? "",
    survey_date: row.survey_date ?? "",
    site_contact_name: row.site_contact_name ?? "",
    site_contact_role: row.site_contact_role ?? "",
    site_contact_phone: row.site_contact_phone ?? "",
    access_notes: row.access_notes ?? "",
    delivery_notes: row.delivery_notes ?? "",
    working_hours: row.working_hours ?? "",
    site_induction_required: row.site_induction_required ?? false,
    ppe_required: row.ppe_required ?? "",
    escort_required: row.escort_required ?? false,
    it_contact_name: row.it_contact_name ?? "",
    network_summary_notes: row.network_summary_notes ?? "",
    cable_route_notes: row.cable_route_notes ?? "",
    containment_present: row.containment_present ?? "",
    floor_boxes_required: row.floor_boxes_required ?? false,
    cable_concealment: row.cable_concealment ?? "",
    firestopping_notes: row.firestopping_notes ?? "",
    ventilation_adequate: row.ventilation_adequate ?? false,
    enclosure_required: row.enclosure_required ?? false,
    direct_sunlight: row.direct_sunlight ?? false,
    temp_humidity_ok: row.temp_humidity_ok ?? false,
    working_at_height: row.working_at_height ?? "",
    asbestos_checked: row.asbestos_checked ?? false,
    rams_required: row.rams_required ?? false,
    dda_compliant: row.dda_compliant ?? false,
    other_trades_notes: row.other_trades_notes ?? "",
    floor_plan_captured: row.floor_plan_captured ?? false,
    measurements_checked: row.measurements_checked ?? false,
    outstanding_items: row.outstanding_items ?? "",
    engineer_notes: row.engineer_notes ?? "",
  };
}

// Every option list here ends with an N/A option, on purpose — same
// convention as MOUNT_TYPES/POWER_SOURCES/etc. in install-form.ts. Add one
// to any new list too, so an engineer is never forced to guess at a value
// that genuinely doesn't apply to this screen.
export const ENVIRONMENT_OPTIONS = ["retail_floor", "reception", "window_facing", "external", "na"];
export const ORIENTATION_OPTIONS = ["landscape", "portrait", "na"];
export const BRIGHTNESS_TIER_OPTIONS = [
  "Standard (~350 nits)",
  "High-bright (700+ nits)",
  "Window/sun-facing (2,500+ nits)",
  "N/A",
];
export const CONNECTION_METHOD_OPTIONS = ["wired", "wifi", "na"];
export const WIFI_SECURITY_OPTIONS = ["WPA2", "WPA3", "N/A"];
export const IP_MODE_OPTIONS = ["dhcp", "static", "na"];

/** Empty (never-persisted) screen row — an "Add screen" tap fills in id/survey_form_id/position and hands this straight to upsertSurveyScreen. */
export function emptySurveyScreen(id: string, surveyFormId: string, position: number): SurveyScreenRow {
  return {
    id,
    survey_form_id: surveyFormId,
    position,
    screen_label: null,
    location: null,
    environment: null,
    mounting_height: null,
    photo_taken: false,
    position_agreed: false,
    screen_size: null,
    orientation: null,
    commercial_grade_required: null,
    brightness_tier: null,
    glare_assessed: false,
    reuse_existing_display: null,
    existing_display_detail: null,
    player_required: null,
    player_location: null,
    ventilation_ok: null,
    shared_power_socket: null,
    hdmi_run_length: null,
    maintenance_access_ok: null,
    reuse_existing_player: null,
    existing_player_detail: null,
    mount_surface: null,
    stud_checked: null,
    estimated_weight: null,
    fixing_type: null,
    existing_bracket_reusable: null,
    overhead_obstructions: null,
    tamper_proof_required: null,
    socket_count: null,
    socket_sufficient: null,
    distance_to_socket: null,
    new_spur_required: null,
    switched_with_lighting: null,
    isolation_notes: null,
    connection_method: null,
    live_data_point: null,
    wifi_signal_checked: false,
    wifi_security: null,
    wifi_ssid: null,
    ip_mode: null,
    vlan: null,
    display_make_model: null,
    player_make_model: null,
    serial_number: null,
    mac_address: null,
    created_at: new Date().toISOString(),
  };
}

/** Empty (never-persisted) action row — an "Add action" tap fills in id/survey_form_id/position and hands this straight to upsertSurveyAction. */
export function emptySurveyAction(id: string, surveyFormId: string, position: number): SurveyActionRow {
  return {
    id,
    survey_form_id: surveyFormId,
    position,
    action: "",
    owner: null,
    due_date: null,
    done: false,
    created_at: new Date().toISOString(),
  };
}

/**
 * Section 13's photo asks, on top of section 2's per-screen "photo of
 * location taken": two survey-wide slots (floor plan, comms room) and
 * three per-screen slots (location, power point, cable route) — the
 * per-screen ones are namespaced by screen id since media_assets' slot
 * column has no per-repeated-item concept of its own.
 */
export const SURVEY_LEVEL_PHOTO_SLOTS = ["photo_floor_plan", "photo_comms_room"] as const;

export function screenPhotoSlots(screenId: string): { key: string; slot: string; label: string }[] {
  return [
    { key: "location", slot: `photo_screen_location_${screenId}`, label: "Screen location" },
    { key: "power", slot: `photo_power_point_${screenId}`, label: "Power point" },
    { key: "cable", slot: `photo_cable_route_${screenId}`, label: "Cable route" },
  ];
}

/**
 * Deliberately light-touch compared to validateJobDetails/validateInstallForm:
 * a survey is a checklist, not a pass/fail inspection, and most of its
 * fields are legitimately "didn't apply at this site" rather than mandatory.
 * The one thing that actually has to be true for the record to be useful —
 * confirmed with the business — is that at least one screen was surveyed
 * and each one says where it is; everything else is optional by design.
 * No signature, no per-photo requirement (see submitSurveyForm's own note).
 */
export function validateSurveyForm(values: SurveyFormValues, screens: SurveyScreenRow[]): string[] {
  const errors: string[] = [];
  if (!values.site_contact_name.trim()) errors.push("Site contact is required.");
  if (screens.length === 0) {
    errors.push("At least one screen must be added.");
  } else {
    screens.forEach((screen, i) => {
      if (!screen.location?.trim()) {
        errors.push(`Screen ${i + 1}: location is required.`);
      }
    });
  }
  return errors;
}
