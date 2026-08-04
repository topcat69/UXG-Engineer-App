// Fixed columns rendered from this typed config — NOT a database-driven form
// builder, per PROMPT.md's Forms section. Conditional logic is plain
// TypeScript predicates over the current form values, also per spec.

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

export const MOUNT_TYPES = ["Wall", "Ceiling", "Freestanding", "Totem"];
export const POWER_SOURCES = ["Existing socket", "New spur", "Requires electrician"];
export const NETWORK_TYPES = ["WiFi", "Ethernet"];
export const WIFI_SIGNALS = ["Excellent", "Good", "Weak", "None"];
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

export function showWifiSignal(values: InstallFormValues): boolean {
  return values.network_type === "WiFi";
}

export function showIssueDetail(values: InstallFormValues): boolean {
  return values.issues_found === true;
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
