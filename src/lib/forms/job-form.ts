// Fixed columns rendered from this typed config — NOT a database-driven form
// builder, per PROMPT.md's Forms section, same convention as install-form.ts.
// Covers install/sla/maintenance/delivery (backed by job_details +
// job_equipment) — survey keeps its own separate survey_forms/install-form.ts
// path untouched.

import type { Database } from "@/lib/supabase/database.types";

export type JobDetailsRow = Database["public"]["Tables"]["job_details"]["Row"];
export type JobEquipmentRow = Database["public"]["Tables"]["job_equipment"]["Row"];

export type JobDetailsType = "install" | "sla" | "maintenance" | "delivery";

export function usesJobDetails(jobType: string): jobType is JobDetailsType {
  return jobType === "install" || jobType === "sla" || jobType === "maintenance" || jobType === "delivery";
}

/** Every selectable job type across the app, with a human-readable label — single source of truth instead of duplicating this list in each picker. */
export const JOB_TYPES = ["install", "sla", "maintenance", "delivery", "survey"] as const;
export const JOB_TYPE_LABELS: Record<(typeof JOB_TYPES)[number], string> = {
  install: "Installation",
  sla: "SLA",
  maintenance: "Maintenance",
  delivery: "Delivery",
  survey: "Survey",
};

export type JobDetailsValues = {
  player_serial: string;
  screen_serial: string;
  mount_type: string;
  power_source: string;
  network_type: string;
  wifi_signal: string;
  network_port: string;
  player_boot_test: string;
  content_displaying: string;
  parking_notified: boolean;
  parking_notes: string;
  reported_to_site_manager: boolean;
  site_manager_name: string;
  site_manager_phone: string;
  revisit_required: string; // "" | "yes" | "no" — tri-state so an unanswered question is distinguishable from "no"
  issues_found: boolean;
  issue_detail: string;
  equipment_damage: string;
  engineer_notes: string;
};

export const EMPTY_JOB_DETAILS: JobDetailsValues = {
  player_serial: "",
  screen_serial: "",
  mount_type: "",
  power_source: "",
  network_type: "",
  wifi_signal: "",
  network_port: "",
  player_boot_test: "",
  content_displaying: "",
  parking_notified: false,
  parking_notes: "",
  reported_to_site_manager: false,
  site_manager_name: "",
  site_manager_phone: "",
  revisit_required: "",
  issues_found: false,
  issue_detail: "",
  equipment_damage: "",
  engineer_notes: "",
};

export const MOUNT_TYPES = ["Wall", "Ceiling", "Freestanding", "Totem", "N/A"];
export const POWER_SOURCES = ["Existing socket", "New spur", "Requires electrician", "N/A"];
export const NETWORK_TYPES = ["WiFi", "Ethernet", "N/A"];
export const WIFI_SIGNALS = ["Excellent", "Good", "Weak", "None", "N/A"];
export const PASS_FAIL: readonly string[] = ["pass", "fail", "na"];

/** Which sections a job type shows, per the spec's per-type section lists. */
export function showsAvFields(jobType: JobDetailsType): boolean {
  return jobType === "install" || jobType === "sla" || jobType === "maintenance";
}
export function showsSiteplanAndEquipment(jobType: JobDetailsType): boolean {
  return jobType === "install";
}
export function showsSlaRequirement(jobType: JobDetailsType): boolean {
  return jobType === "sla" || jobType === "maintenance";
}
/**
 * Every job_details type gets the issues section, including delivery —
 * originally spec'd as install/sla/maintenance only ("delivery has none",
 * see 20260117000000_job_details.sql), but a delivery can go wrong (wrong
 * item, damaged in transit, wrong address) just as much as an install can,
 * and there was no way for an engineer to log that at all.
 */
export function showsIssuesSection(jobType: JobDetailsType): boolean {
  return jobType === "install" || jobType === "sla" || jobType === "maintenance" || jobType === "delivery";
}
export function showsRevisitRequired(jobType: JobDetailsType): boolean {
  return jobType === "install" || jobType === "sla";
}

/** Photo slots per job type — delivery's "prior to packing" replaces the others' "before starting". */
export function photoSlotsFor(jobType: JobDetailsType): readonly string[] {
  const before = jobType === "delivery" ? "photo_before_packing" : "photo_before";
  return [before, "photo_completed", "photo_equipment_in_situ"] as const;
}

/**
 * Keys a manager can mark optional for one specific job (see
 * job_optional_fields, 20260122000000_job_optional_fields.sql) — exactly
 * the set validateJobDetails below checks, kept as one list so the office
 * toggle UI and the validator can't drift apart. Deliberately excludes
 * photos and the signature: those are evidence capture, not form data, and
 * stay mandatory regardless of this override.
 */
export type RequirableFieldKey =
  | "player_serial"
  | "screen_serial"
  | "mount_type"
  | "power_source"
  | "network_type"
  | "wifi_signal"
  | "network_port"
  | "player_boot_test"
  | "content_displaying"
  | "reported_to_site_manager"
  | "issue_detail"
  | "equipment_damage"
  | "revisit_required";

export type RequirableField = { key: RequirableFieldKey; label: string };

/** Every field a manager can toggle for this job type, in the order the form/office panel render them. */
export function requirableFieldsFor(jobType: JobDetailsType): RequirableField[] {
  const fields: RequirableField[] = [];
  if (showsAvFields(jobType)) {
    fields.push(
      { key: "player_serial", label: "Player serial" },
      { key: "screen_serial", label: "Screen serial" },
      { key: "mount_type", label: "Mount type" },
      { key: "power_source", label: "Power source" },
      { key: "network_type", label: "Network type" },
      { key: "wifi_signal", label: "WiFi signal" },
      { key: "network_port", label: "Network port" },
      { key: "player_boot_test", label: "Player boot test" },
      { key: "content_displaying", label: "Content displaying" },
    );
  }
  fields.push({ key: "reported_to_site_manager", label: "Reported to site manager" });
  if (showsIssuesSection(jobType)) {
    fields.push({ key: "issue_detail", label: "Issue detail" });
    fields.push({ key: "equipment_damage", label: "Equipment damage" });
  }
  if (showsRevisitRequired(jobType)) fields.push({ key: "revisit_required", label: "Revisit required" });
  return fields;
}

export function showWifiSignal(values: JobDetailsValues): boolean {
  return values.network_type === "WiFi";
}

export function showNetworkPort(values: JobDetailsValues): boolean {
  return values.network_type === "Ethernet";
}

export function showIssueDetail(values: JobDetailsValues): boolean {
  return values.issues_found === true;
}

/** Converts a Dexie/DB job_details row into form values, defaulting missing fields. */
export function jobDetailsRowToValues(row: JobDetailsRow | undefined): JobDetailsValues {
  if (!row) return EMPTY_JOB_DETAILS;
  return {
    player_serial: row.player_serial ?? "",
    screen_serial: row.screen_serial ?? "",
    mount_type: row.mount_type ?? "",
    power_source: row.power_source ?? "",
    network_type: row.network_type ?? "",
    wifi_signal: row.wifi_signal ?? "",
    network_port: row.network_port ?? "",
    player_boot_test: row.player_boot_test ?? "",
    content_displaying: row.content_displaying ?? "",
    parking_notified: row.parking_notified ?? false,
    parking_notes: row.parking_notes ?? "",
    reported_to_site_manager: row.reported_to_site_manager ?? false,
    site_manager_name: row.site_manager_name ?? "",
    site_manager_phone: row.site_manager_phone ?? "",
    revisit_required: row.revisit_required === null ? "" : row.revisit_required ? "yes" : "no",
    issues_found: row.issues_found ?? false,
    issue_detail: row.issue_detail ?? "",
    equipment_damage: row.equipment_damage ?? "",
    engineer_notes: row.engineer_notes ?? "",
  };
}

export type AutoIssue = { severity: "high" | "medium"; description: string; blocksCompletion: boolean };

/**
 * Same shape as install-form.ts's detectAutoIssues — a failed boot
 * test/content check blocks completion and triggers an automatic revisit
 * via the existing issues.blocks_completion webhook (see
 * create-revisit.ts). "Revisit Required: Yes" goes through that identical
 * mechanism rather than a separate one — it's just an explicit
 * engineer-driven trigger for the same underlying "this needs a follow-up
 * visit" outcome a failed check already produces.
 */
export function detectAutoIssues(jobType: JobDetailsType, values: JobDetailsValues): AutoIssue[] {
  const issues: AutoIssue[] = [];
  if (showsAvFields(jobType)) {
    if (values.player_boot_test === "fail") {
      issues.push({ severity: "high", description: "Player boot test failed.", blocksCompletion: true });
    }
    if (values.content_displaying === "fail") {
      issues.push({ severity: "high", description: "Content not displaying on screen.", blocksCompletion: true });
    }
  }
  if (showsRevisitRequired(jobType) && values.revisit_required === "yes") {
    issues.push({ severity: "high", description: "Revisit required (flagged by engineer).", blocksCompletion: true });
  }
  if (values.issues_found && values.issue_detail.trim()) {
    issues.push({ severity: "medium", description: values.issue_detail.trim(), blocksCompletion: false });
  }
  return issues;
}

/**
 * All reasons the form isn't ready to submit yet — empty array means ready.
 * `optionalFields` is whatever a manager has opted this specific job out of
 * (see job_optional_fields / requirableFieldsFor above) — defaults to
 * empty, i.e. every field mandatory, matching "by default everything is
 * required" for jobs with no override on file.
 */
export function validateJobDetails(
  jobType: JobDetailsType,
  values: JobDetailsValues,
  capturedSlots: ReadonlySet<string>,
  hasSignature: boolean,
  optionalFields: ReadonlySet<string> = new Set(),
): string[] {
  const errors: string[] = [];
  const requires = (key: RequirableFieldKey) => !optionalFields.has(key);

  if (showsAvFields(jobType)) {
    if (requires("player_serial") && !values.player_serial.trim()) errors.push("Player serial is required.");
    if (requires("screen_serial") && !values.screen_serial.trim()) errors.push("Screen serial is required.");
    if (requires("mount_type") && !values.mount_type) errors.push("Mount type is required.");
    if (requires("power_source") && !values.power_source) errors.push("Power source is required.");
    if (requires("network_type") && !values.network_type) errors.push("Network type is required.");
    if (requires("wifi_signal") && showWifiSignal(values) && !values.wifi_signal) errors.push("WiFi signal is required.");
    if (requires("network_port") && showNetworkPort(values) && !values.network_port.trim())
      errors.push("Network port is required.");
    if (requires("player_boot_test") && !values.player_boot_test) errors.push("Player boot test result is required.");
    if (requires("content_displaying") && !values.content_displaying) errors.push("Content displaying result is required.");
  }

  if (requires("reported_to_site_manager") && !values.reported_to_site_manager) {
    errors.push("Reporting to the site manager is required.");
  }
  if (requires("issue_detail") && showIssueDetail(values) && !values.issue_detail.trim()) {
    errors.push("Issue detail is required.");
  }
  if (requires("equipment_damage") && showsIssuesSection(jobType) && !values.equipment_damage) {
    errors.push("Equipment damage is required.");
  }
  if (requires("revisit_required") && showsRevisitRequired(jobType) && !values.revisit_required) {
    errors.push("Revisit required must be answered.");
  }

  for (const slot of photoSlotsFor(jobType)) {
    if (!capturedSlots.has(slot)) {
      errors.push(`Photo required: ${slot.replace("photo_", "").replace(/_/g, " ")}.`);
    }
  }
  if (!hasSignature) errors.push("Customer signature is required.");

  return errors;
}
