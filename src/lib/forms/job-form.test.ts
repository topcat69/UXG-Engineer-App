import { describe, expect, it } from "vitest";
import {
  EMPTY_JOB_DETAILS,
  detectAutoIssues,
  photoSlotsFor,
  requirableFieldsFor,
  showIssueDetail,
  showWifiSignal,
  showsAvFields,
  showsIssuesSection,
  showsRevisitRequired,
  showsSiteplanAndEquipment,
  showsSlaRequirement,
  usesJobDetails,
  validateJobDetails,
  type JobDetailsValues,
} from "./job-form";

const completeAvValues: JobDetailsValues = {
  ...EMPTY_JOB_DETAILS,
  player_serial: "PLR-1",
  screen_serial: "SCR-1",
  mount_type: "Wall",
  power_source: "Existing socket",
  network_type: "Ethernet",
  player_boot_test: "pass",
  content_displaying: "pass",
  reported_to_site_manager: true,
};

describe("usesJobDetails", () => {
  it("is true for install/sla/maintenance/delivery, false for survey", () => {
    expect(usesJobDetails("install")).toBe(true);
    expect(usesJobDetails("sla")).toBe(true);
    expect(usesJobDetails("maintenance")).toBe(true);
    expect(usesJobDetails("delivery")).toBe(true);
    expect(usesJobDetails("survey")).toBe(false);
  });
});

describe("per-type section visibility", () => {
  it("shows AV fields for install/sla/maintenance only", () => {
    expect(showsAvFields("install")).toBe(true);
    expect(showsAvFields("sla")).toBe(true);
    expect(showsAvFields("maintenance")).toBe(true);
    expect(showsAvFields("delivery")).toBe(false);
  });

  it("shows site plan + equipment list for install only", () => {
    expect(showsSiteplanAndEquipment("install")).toBe(true);
    expect(showsSiteplanAndEquipment("sla")).toBe(false);
    expect(showsSiteplanAndEquipment("maintenance")).toBe(false);
    expect(showsSiteplanAndEquipment("delivery")).toBe(false);
  });

  it("shows SLA requirement detail for sla + maintenance only", () => {
    expect(showsSlaRequirement("sla")).toBe(true);
    expect(showsSlaRequirement("maintenance")).toBe(true);
    expect(showsSlaRequirement("install")).toBe(false);
    expect(showsSlaRequirement("delivery")).toBe(false);
  });

  it("shows the issues section for install/sla/maintenance, not delivery", () => {
    expect(showsIssuesSection("install")).toBe(true);
    expect(showsIssuesSection("sla")).toBe(true);
    expect(showsIssuesSection("maintenance")).toBe(true);
    expect(showsIssuesSection("delivery")).toBe(false);
  });

  it("shows revisit required for install + sla only", () => {
    expect(showsRevisitRequired("install")).toBe(true);
    expect(showsRevisitRequired("sla")).toBe(true);
    expect(showsRevisitRequired("maintenance")).toBe(false);
    expect(showsRevisitRequired("delivery")).toBe(false);
  });

  it("delivery's before-photo is 'prior to packing', others are 'before starting'", () => {
    expect(photoSlotsFor("delivery")).toEqual(["photo_before_packing", "photo_completed", "photo_equipment_in_situ"]);
    expect(photoSlotsFor("install")).toEqual(["photo_before", "photo_completed", "photo_equipment_in_situ"]);
  });
});

describe("showWifiSignal / showIssueDetail", () => {
  it("shows wifi signal only when network type is WiFi", () => {
    expect(showWifiSignal({ ...completeAvValues, network_type: "WiFi" })).toBe(true);
    expect(showWifiSignal({ ...completeAvValues, network_type: "Ethernet" })).toBe(false);
  });

  it("shows issue detail only when issues_found is true", () => {
    expect(showIssueDetail({ ...completeAvValues, issues_found: true })).toBe(true);
    expect(showIssueDetail({ ...completeAvValues, issues_found: false })).toBe(false);
  });
});

describe("validateJobDetails", () => {
  const avSlots = new Set(["photo_before", "photo_completed", "photo_equipment_in_situ"]);
  const deliverySlots = new Set(["photo_before_packing", "photo_completed", "photo_equipment_in_situ"]);

  it("passes install with AV fields, revisit answered, all photos and a signature", () => {
    const values = { ...completeAvValues, revisit_required: "no" };
    expect(validateJobDetails("install", values, avSlots, true)).toEqual([]);
  });

  it("does not require AV fields or revisit for delivery", () => {
    const values = { ...EMPTY_JOB_DETAILS, reported_to_site_manager: true };
    expect(validateJobDetails("delivery", values, deliverySlots, true)).toEqual([]);
  });

  it("requires revisit_required to be answered for install/sla but not maintenance/delivery", () => {
    const values = { ...completeAvValues, revisit_required: "" };
    expect(validateJobDetails("install", values, avSlots, true)).toContain("Revisit required must be answered.");
    expect(validateJobDetails("sla", values, avSlots, true)).toContain("Revisit required must be answered.");
    expect(validateJobDetails("maintenance", values, avSlots, true)).not.toContain(
      "Revisit required must be answered.",
    );
  });

  it("requires reporting to the site manager for every type, including delivery", () => {
    const values = { ...EMPTY_JOB_DETAILS };
    expect(validateJobDetails("delivery", values, deliverySlots, true)).toContain(
      "Reporting to the site manager is required.",
    );
  });

  it("lists every missing required photo by name for the job type's own slot set", () => {
    const errors = validateJobDetails("delivery", { ...EMPTY_JOB_DETAILS, reported_to_site_manager: true }, new Set(), true);
    expect(errors).toContain("Photo required: before packing.");
    expect(errors).toContain("Photo required: completed.");
    expect(errors).toContain("Photo required: equipment in situ.");
  });
});

describe("requirableFieldsFor", () => {
  it("includes AV fields plus reported-to-site-manager and revisit for install", () => {
    const keys = requirableFieldsFor("install").map((f) => f.key);
    expect(keys).toContain("player_serial");
    expect(keys).toContain("reported_to_site_manager");
    expect(keys).toContain("issue_detail");
    expect(keys).toContain("revisit_required");
  });

  it("drops AV fields, issue detail, and revisit for delivery — only reported-to-site-manager remains", () => {
    expect(requirableFieldsFor("delivery").map((f) => f.key)).toEqual(["reported_to_site_manager"]);
  });

  it("keeps issue detail but drops revisit for maintenance", () => {
    const keys = requirableFieldsFor("maintenance").map((f) => f.key);
    expect(keys).toContain("issue_detail");
    expect(keys).not.toContain("revisit_required");
  });
});

describe("validateJobDetails with optionalFields", () => {
  const avSlots = new Set(["photo_before", "photo_completed", "photo_equipment_in_situ"]);
  const deliverySlots = new Set(["photo_before_packing", "photo_completed", "photo_equipment_in_situ"]);

  it("skips a field's required-check once it's in optionalFields, leaving every other check intact", () => {
    const values = { ...completeAvValues, revisit_required: "no", player_serial: "" };
    expect(validateJobDetails("install", values, avSlots, true)).toContain("Player serial is required.");
    expect(validateJobDetails("install", values, avSlots, true, new Set(["player_serial"]))).not.toContain(
      "Player serial is required.",
    );
  });

  it("defaults to every field mandatory when optionalFields is omitted — no behavior change for existing jobs", () => {
    const values = { ...EMPTY_JOB_DETAILS };
    expect(validateJobDetails("delivery", values, deliverySlots, true)).toContain(
      "Reporting to the site manager is required.",
    );
  });

  it("marking reported_to_site_manager optional lets a delivery job pass without it", () => {
    const values = { ...EMPTY_JOB_DETAILS };
    const errors = validateJobDetails(
      "delivery",
      values,
      deliverySlots,
      true,
      new Set(["reported_to_site_manager"]),
    );
    expect(errors).not.toContain("Reporting to the site manager is required.");
  });

  it("never makes photos or the signature optional — optionalFields only covers form fields", () => {
    const values = { ...completeAvValues, revisit_required: "no" };
    const errors = validateJobDetails(
      "install",
      values,
      new Set(),
      false,
      new Set(["player_serial", "screen_serial", "mount_type", "power_source", "network_type", "player_boot_test", "content_displaying", "reported_to_site_manager", "revisit_required"]),
    );
    expect(errors).toContain("Customer signature is required.");
    expect(errors.some((e) => e.startsWith("Photo required"))).toBe(true);
  });
});

describe("detectAutoIssues", () => {
  it("raises nothing for a fully passing install form", () => {
    expect(detectAutoIssues("install", completeAvValues)).toEqual([]);
  });

  it("raises a blocking issue when the player boot test fails, for AV-field job types", () => {
    const issues = detectAutoIssues("install", { ...completeAvValues, player_boot_test: "fail" });
    expect(issues).toEqual([{ severity: "high", description: "Player boot test failed.", blocksCompletion: true }]);
  });

  it("never raises AV-based issues for delivery, even if those fields were somehow set", () => {
    const issues = detectAutoIssues("delivery", { ...completeAvValues, player_boot_test: "fail" });
    expect(issues).toEqual([]);
  });

  it("raises a blocking issue when the engineer answers Revisit Required: Yes, for install/sla only", () => {
    const issues = detectAutoIssues("install", { ...completeAvValues, revisit_required: "yes" });
    expect(issues).toEqual([
      { severity: "high", description: "Revisit required (flagged by engineer).", blocksCompletion: true },
    ]);
    // maintenance has no revisit-required section, so the same "yes" value on that type raises nothing.
    expect(detectAutoIssues("maintenance", { ...completeAvValues, revisit_required: "yes" })).toEqual([]);
  });

  it("raises a non-blocking issue from the engineer's manual note, for any type", () => {
    const issues = detectAutoIssues("delivery", {
      ...EMPTY_JOB_DETAILS,
      issues_found: true,
      issue_detail: "Damaged in transit",
    });
    expect(issues).toEqual([{ severity: "medium", description: "Damaged in transit", blocksCompletion: false }]);
  });
});
