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
  player_boot_test: string;
  content_displaying: string;
  parking_notified: boolean;
  reported_to_site_manager: boolean;
  revisit_required: string; // "" | "yes" | "no" — tri-state so an unanswered question is distinguishable from "no"
  issues_found: boolean;
  issue_detail: string;
  engineer_notes: string;
};

export const EMPTY_JOB_DETAILS: JobDetailsValues = {
  player_serial: "",
  screen_serial: "",
  mount_type: "",
  power_source: "",
  network_type: "",
  wifi_signal: "",
  player_boot_test: "",
  content_displaying: "",
  parking_notified: false,
  reported_to_site_manager: false,
  revisit_required: "",
  issues_found: false,
  issue_detail: "",
  engineer_notes: "",
};

export const MOUNT_TYPES = ["Wall", "Ceiling", "Freestanding", "Totem"];
export const POWER_SOURCES = ["Existing socket", "New spur", "Requires electrician"];
export const NETWORK_TYPES = ["WiFi", "Ethernet"];
export const WIFI_SIGNALS = ["Excellent", "Good", "Weak", "None"];
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
export function showsIssuesSection(jobType: JobDetailsType): boolean {
  return jobType === "install" || jobType === "sla" || jobType === "maintenance";
}
export function showsRevisitRequired(jobType: JobDetailsType): boolean {
  return jobType === "install" || jobType === "sla";
}

/** Photo slots per job type — delivery's "prior to packing" replaces the others' "before starting". */
export function photoSlotsFor(jobType: JobDetailsType): readonly string[] {
  const before = jobType === "delivery" ? "photo_before_packing" : "photo_before";
  return [before, "photo_completed", "photo_equipment_in_situ"] as const;
}

export function showWifiSignal(values: JobDetailsValues): boolean {
  return values.network_type === "WiFi";
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
    player_boot_test: row.player_boot_test ?? "",
    content_displaying: row.content_displaying ?? "",
    parking_notified: row.parking_notified ?? false,
    reported_to_site_manager: row.reported_to_site_manager ?? false,
    revisit_required: row.revisit_required === null ? "" : row.revisit_required ? "yes" : "no",
    issues_found: row.issues_found ?? false,
    issue_detail: row.issue_detail ?? "",
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

/** All reasons the form isn't ready to submit yet — empty array means ready. */
export function validateJobDetails(
  jobType: JobDetailsType,
  values: JobDetailsValues,
  capturedSlots: ReadonlySet<string>,
  hasSignature: boolean,
): string[] {
  const errors: string[] = [];

  if (showsAvFields(jobType)) {
    if (!values.player_serial.trim()) errors.push("Player serial is required.");
    if (!values.screen_serial.trim()) errors.push("Screen serial is required.");
    if (!values.mount_type) errors.push("Mount type is required.");
    if (!values.power_source) errors.push("Power source is required.");
    if (!values.network_type) errors.push("Network type is required.");
    if (showWifiSignal(values) && !values.wifi_signal) errors.push("WiFi signal is required.");
    if (!values.player_boot_test) errors.push("Player boot test result is required.");
    if (!values.content_displaying) errors.push("Content displaying result is required.");
  }

  if (!values.reported_to_site_manager) errors.push("Reporting to the site manager is required.");
  if (showIssueDetail(values) && !values.issue_detail.trim()) errors.push("Issue detail is required.");
  if (showsRevisitRequired(jobType) && !values.revisit_required) errors.push("Revisit required must be answered.");

  for (const slot of photoSlotsFor(jobType)) {
    if (!capturedSlots.has(slot)) {
      errors.push(`Photo required: ${slot.replace("photo_", "").replace(/_/g, " ")}.`);
    }
  }
  if (!hasSignature) errors.push("Customer signature is required.");

  return errors;
}
