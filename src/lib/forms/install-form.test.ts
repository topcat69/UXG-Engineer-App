import { describe, expect, it } from "vitest";
import {
  EMPTY_INSTALL_FORM,
  PHOTO_SLOTS,
  detectAutoIssues,
  showIssueDetail,
  showNetworkPort,
  showWifiSignal,
  validateInstallForm,
  type InstallFormValues,
} from "./install-form";

const completeValues: InstallFormValues = {
  player_serial: "PLR-1",
  screen_serial: "SCR-1",
  mount_type: "Wall",
  power_source: "Existing socket",
  network_type: "Ethernet",
  wifi_signal: "",
  network_port: "24",
  player_boot_test: "pass",
  content_displaying: "pass",
  issues_found: false,
  issue_detail: "",
  equipment_damage: "na",
  engineer_notes: "",
  client_name: "Jane Doe",
};

const allSlots = new Set<string>(PHOTO_SLOTS);

describe("showWifiSignal / showIssueDetail", () => {
  it("shows wifi signal only when network type is WiFi", () => {
    expect(showWifiSignal({ ...completeValues, network_type: "WiFi" })).toBe(true);
    expect(showWifiSignal({ ...completeValues, network_type: "Ethernet" })).toBe(false);
  });

  it("shows issue detail only when issues_found is true", () => {
    expect(showIssueDetail({ ...completeValues, issues_found: true })).toBe(true);
    expect(showIssueDetail({ ...completeValues, issues_found: false })).toBe(false);
  });

  it("shows network port only when network type is Ethernet", () => {
    expect(showNetworkPort({ ...completeValues, network_type: "Ethernet" })).toBe(true);
    expect(showNetworkPort({ ...completeValues, network_type: "WiFi" })).toBe(false);
  });
});

describe("validateInstallForm", () => {
  it("passes for a fully complete Ethernet job with all photos and a signature", () => {
    expect(validateInstallForm(completeValues, allSlots, true)).toEqual([]);
  });

  it("fails on a completely empty form", () => {
    const errors = validateInstallForm(EMPTY_INSTALL_FORM, new Set(), false);
    expect(errors.length).toBeGreaterThan(5);
    expect(errors).toContain("Customer signature is required.");
  });

  it("requires wifi_signal when network_type is WiFi, but not otherwise", () => {
    const withWifi = { ...completeValues, network_type: "WiFi", wifi_signal: "" };
    expect(validateInstallForm(withWifi, allSlots, true)).toContain("WiFi signal is required.");

    const withWifiFilled = { ...withWifi, wifi_signal: "Good" };
    expect(validateInstallForm(withWifiFilled, allSlots, true)).toEqual([]);
  });

  it("requires network_port when network_type is Ethernet, but not otherwise", () => {
    const withEthernet = { ...completeValues, network_type: "Ethernet", network_port: "" };
    expect(validateInstallForm(withEthernet, allSlots, true)).toContain("Network port is required.");

    const withWifi = { ...completeValues, network_type: "WiFi", wifi_signal: "Good", network_port: "" };
    expect(validateInstallForm(withWifi, allSlots, true)).not.toContain("Network port is required.");
  });

  it("requires issue_detail only when issues_found is true", () => {
    const withIssue = { ...completeValues, issues_found: true, issue_detail: "" };
    expect(validateInstallForm(withIssue, allSlots, true)).toContain("Issue detail is required.");

    const withIssueDescribed = { ...withIssue, issue_detail: "Cable trunking missing" };
    expect(validateInstallForm(withIssueDescribed, allSlots, true)).toEqual([]);
  });

  it("requires equipment_damage to be answered", () => {
    const withoutDamage = { ...completeValues, equipment_damage: "" };
    expect(validateInstallForm(withoutDamage, allSlots, true)).toContain("Equipment damage is required.");
  });

  it("lists every missing required photo by name", () => {
    const errors = validateInstallForm(completeValues, new Set(["photo_before"]), true);
    expect(errors).toContain("Photo required: screen mounted.");
    expect(errors).toContain("Photo required: wide shot.");
    expect(errors).not.toContain("Photo required: before.");
  });
});

describe("detectAutoIssues", () => {
  it("raises nothing for a fully passing form with no issues noted", () => {
    expect(detectAutoIssues(completeValues)).toEqual([]);
  });

  it("raises a blocking issue when the player boot test fails", () => {
    const issues = detectAutoIssues({ ...completeValues, player_boot_test: "fail" });
    expect(issues).toEqual([{ severity: "high", description: "Player boot test failed.", blocksCompletion: true }]);
  });

  it("raises a blocking issue when content isn't displaying", () => {
    const issues = detectAutoIssues({ ...completeValues, content_displaying: "fail" });
    expect(issues).toEqual([
      { severity: "high", description: "Content not displaying on screen.", blocksCompletion: true },
    ]);
  });

  it("raises both when both checks fail", () => {
    const issues = detectAutoIssues({ ...completeValues, player_boot_test: "fail", content_displaying: "fail" });
    expect(issues).toHaveLength(2);
    expect(issues.every((i) => i.blocksCompletion)).toBe(true);
  });

  it("raises a non-blocking issue from the engineer's manual issues_found note", () => {
    const issues = detectAutoIssues({ ...completeValues, issues_found: true, issue_detail: "Loose cable trunking" });
    expect(issues).toEqual([{ severity: "medium", description: "Loose cable trunking", blocksCompletion: false }]);
  });

  it("does not raise a manual issue when issues_found is true but the detail is blank", () => {
    expect(detectAutoIssues({ ...completeValues, issues_found: true, issue_detail: "   " })).toEqual([]);
  });

  it("treats 'na' the same as 'pass' — not a failure", () => {
    expect(detectAutoIssues({ ...completeValues, player_boot_test: "na", content_displaying: "na" })).toEqual([]);
  });
});
