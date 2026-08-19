// Fixed columns rendered from this typed config — NOT a database-driven form
// builder, per PROMPT.md's Forms section. Conditional logic is plain
// TypeScript predicates over the current form values, also per spec.

import type { Database } from "@/lib/supabase/database.types";

export type InstallFormRow = Database["public"]["Tables"]["install_forms"]["Row"];

export type InstallFormValues = {
  player_serial: string;
  screen_serial: string;
  mount_type: string;
  power_source: string;
  network_type: string;
  wifi_signal: string;
  player_boot_test: string;
  content_displaying: string;
  issues_found: boolean;
  issue_detail: string;
  engineer_notes: string;
  client_name: string;
};

export const EMPTY_INSTALL_FORM: InstallFormValues = {
  player_serial: "",
  screen_serial: "",
  mount_type: "",
  power_source: "",
  network_type: "",
  wifi_signal: "",
  player_boot_test: "",
  content_displaying: "",
  issues_found: false,
  issue_detail: "",
  engineer_notes: "",
  client_name: "",
};

export const MOUNT_TYPES = ["Wall", "Ceiling", "Freestanding", "Totem", "N/A"];
export const POWER_SOURCES = ["Existing socket", "New spur", "Requires electrician", "N/A"];
export const NETWORK_TYPES = ["WiFi", "Ethernet", "N/A"];
export const WIFI_SIGNALS = ["Excellent", "Good", "Weak", "None", "N/A"];
export const PASS_FAIL: readonly string[] = ["pass", "fail", "na"];

export const PHOTO_SLOTS = [
  "photo_before",
  "photo_screen_mounted",
  "photo_player_installed",
  "photo_cable_management",
  "photo_content_on_screen",
  "photo_wide_shot",
] as const;

export type PhotoSlot = (typeof PHOTO_SLOTS)[number];

/** Converts a Dexie/DB install_forms row into form values, defaulting missing fields — shared by the field UI and the auto-issue detection at submit time. */
export function installFormRowToValues(row: InstallFormRow | undefined): InstallFormValues {
  if (!row) return EMPTY_INSTALL_FORM;
  return {
    player_serial: row.player_serial ?? "",
    screen_serial: row.screen_serial ?? "",
    mount_type: row.mount_type ?? "",
    power_source: row.power_source ?? "",
    network_type: row.network_type ?? "",
    wifi_signal: row.wifi_signal ?? "",
    player_boot_test: row.player_boot_test ?? "",
    content_displaying: row.content_displaying ?? "",
    issues_found: row.issues_found ?? false,
    issue_detail: row.issue_detail ?? "",
    engineer_notes: row.engineer_notes ?? "",
    client_name: row.client_name ?? "",
  };
}

export function showWifiSignal(values: InstallFormValues): boolean {
  return values.network_type === "WiFi";
}

export function showIssueDetail(values: InstallFormValues): boolean {
  return values.issues_found === true;
}

export type AutoIssue = { severity: "high" | "medium"; description: string; blocksCompletion: boolean };

/**
 * Phase 5: "raise issue manually or automatically from a `fail` answer."
 * A failed boot test or failed content check means the install genuinely
 * isn't working, so those block completion (and, via the
 * issues.blocks_completion webhook, trigger an automatic revisit job) —
 * the engineer's own "issues found" note is informational by comparison
 * and doesn't block on its own. Pure so this can be unit tested without
 * touching Dexie or the outbox.
 */
export function detectAutoIssues(values: InstallFormValues): AutoIssue[] {
  const issues: AutoIssue[] = [];
  if (values.player_boot_test === "fail") {
    issues.push({ severity: "high", description: "Player boot test failed.", blocksCompletion: true });
  }
  if (values.content_displaying === "fail") {
    issues.push({ severity: "high", description: "Content not displaying on screen.", blocksCompletion: true });
  }
  if (values.issues_found && values.issue_detail.trim()) {
    issues.push({ severity: "medium", description: values.issue_detail.trim(), blocksCompletion: false });
  }
  return issues;
}

/** All reasons the form isn't ready to submit yet — empty array means ready. */
export function validateInstallForm(
  values: InstallFormValues,
  capturedSlots: ReadonlySet<string>,
  hasSignature: boolean,
): string[] {
  const errors: string[] = [];

  if (!values.player_serial.trim()) errors.push("Player serial is required.");
  if (!values.screen_serial.trim()) errors.push("Screen serial is required.");
  if (!values.mount_type) errors.push("Mount type is required.");
  if (!values.power_source) errors.push("Power source is required.");
  if (!values.network_type) errors.push("Network type is required.");
  if (showWifiSignal(values) && !values.wifi_signal) errors.push("WiFi signal is required.");
  if (!values.player_boot_test) errors.push("Player boot test result is required.");
  if (!values.content_displaying) errors.push("Content displaying result is required.");
  if (showIssueDetail(values) && !values.issue_detail.trim()) errors.push("Issue detail is required.");
  if (!values.client_name.trim()) errors.push("Client name is required.");

  for (const slot of PHOTO_SLOTS) {
    if (!capturedSlots.has(slot)) {
      errors.push(`Photo required: ${slot.replace("photo_", "").replace(/_/g, " ")}.`);
    }
  }
  if (!hasSignature) errors.push("Client signature is required.");

  return errors;
}
