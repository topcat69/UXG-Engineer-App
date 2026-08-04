import { describe, expect, it } from "vitest";
import {
  EMPTY_INSTALL_FORM,
  PHOTO_SLOTS,
  showIssueDetail,
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
  player_boot_test: "pass",
  content_displaying: "pass",
  issues_found: false,
  issue_detail: "",
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
});

describe("validateInstallForm", () => {
  it("passes for a fully complete Ethernet job with all photos and a signature", () => {
    expect(validateInstallForm(completeValues, allSlots, true)).toEqual([]);
  });

  it("fails on a completely empty form", () => {
    const errors = validateInstallForm(EMPTY_INSTALL_FORM, new Set(), false);
    expect(errors.length).toBeGreaterThan(5);
    expect(errors).toContain("Client signature is required.");
  });

  it("requires wifi_signal when network_type is WiFi, but not otherwise", () => {
    const withWifi = { ...completeValues, network_type: "WiFi", wifi_signal: "" };
    expect(validateInstallForm(withWifi, allSlots, true)).toContain("WiFi signal is required.");

    const withWifiFilled = { ...withWifi, wifi_signal: "Good" };
    expect(validateInstallForm(withWifiFilled, allSlots, true)).toEqual([]);
  });

  it("requires issue_detail only when issues_found is true", () => {
    const withIssue = { ...completeValues, issues_found: true, issue_detail: "" };
    expect(validateInstallForm(withIssue, allSlots, true)).toContain("Issue detail is required.");

    const withIssueDescribed = { ...withIssue, issue_detail: "Cable trunking missing" };
    expect(validateInstallForm(withIssueDescribed, allSlots, true)).toEqual([]);
  });

  it("lists every missing required photo by name", () => {
    const errors = validateInstallForm(completeValues, new Set(["photo_before"]), true);
    expect(errors).toContain("Photo required: screen mounted.");
    expect(errors).toContain("Photo required: wide shot.");
    expect(errors).not.toContain("Photo required: before.");
  });
});
