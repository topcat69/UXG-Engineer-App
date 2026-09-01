import { describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import { cloneEquipmentForJob, cloneJobDetailsForRevisit } from "./clone-job-details";

type JobDetailsRow = Database["public"]["Tables"]["job_details"]["Row"];

function jobDetailsRow(overrides: Partial<JobDetailsRow> = {}): JobDetailsRow {
  return {
    id: "details-1",
    job_id: "job-1",
    player_serial: "PLR-1",
    screen_serial: "SCR-1",
    mount_type: "Wall",
    power_source: "Existing socket",
    network_type: "Ethernet",
    wifi_signal: null,
    network_port: "Port 1",
    player_boot_test: "pass",
    content_displaying: "pass",
    rams_storage_path: "jobs/job-1/rams-1.pdf",
    site_plan_storage_path: "jobs/job-1/site_plan-1.pdf",
    design_pack_storage_path: "jobs/job-1/design_pack-1.pdf",
    parking_permit_storage_path: "jobs/job-1/parking_permit-1.pdf",
    sla_requirement_detail: "4-hour response",
    job_information: "Site manager on site 9-5",
    parking_notes: "Use the loading bay round back",
    parking_notified: true,
    site_manager_name: "Sam Okafor",
    site_manager_phone: "01234 567890",
    reported_to_site_manager: true,
    revisit_required: false,
    issues_found: true,
    issue_detail: "Player boot test failed",
    equipment_damage: "na",
    engineer_notes: "All good otherwise",
    submitted_at: "2026-08-24T10:00:00Z",
    created_at: "2026-08-24T08:00:00Z",
    ...overrides,
  };
}

describe("cloneJobDetailsForRevisit", () => {
  it("carries over office-prep documents and site/equipment facts", () => {
    const result = cloneJobDetailsForRevisit(jobDetailsRow());
    expect(result).toMatchObject({
      rams_storage_path: "jobs/job-1/rams-1.pdf",
      site_plan_storage_path: "jobs/job-1/site_plan-1.pdf",
      design_pack_storage_path: "jobs/job-1/design_pack-1.pdf",
      parking_permit_storage_path: "jobs/job-1/parking_permit-1.pdf",
      job_information: "Site manager on site 9-5",
      sla_requirement_detail: "4-hour response",
      parking_notes: "Use the loading bay round back",
      site_manager_name: "Sam Okafor",
      site_manager_phone: "01234 567890",
      player_serial: "PLR-1",
      screen_serial: "SCR-1",
      mount_type: "Wall",
      power_source: "Existing socket",
      network_type: "Ethernet",
      network_port: "Port 1",
    });
  });

  it("never carries over answers/outcomes from the original visit", () => {
    const result = cloneJobDetailsForRevisit(jobDetailsRow());
    const outcomeFields = [
      "player_boot_test",
      "content_displaying",
      "parking_notified",
      "reported_to_site_manager",
      "revisit_required",
      "issues_found",
      "issue_detail",
      "equipment_damage",
      "engineer_notes",
      "submitted_at",
    ];
    for (const field of outcomeFields) {
      expect(result).not.toHaveProperty(field);
    }
  });

  it("does not carry over the source's own id/job_id — those belong to the new row", () => {
    const result = cloneJobDetailsForRevisit(jobDetailsRow());
    expect(result).not.toHaveProperty("id");
    expect(result).not.toHaveProperty("job_id");
  });

  it("carries over nulls as-is (e.g. a document never attached on the original job)", () => {
    const result = cloneJobDetailsForRevisit(jobDetailsRow({ rams_storage_path: null, wifi_signal: null }));
    expect(result.rams_storage_path).toBeNull();
    expect(result.wifi_signal).toBeNull();
  });
});

describe("cloneEquipmentForJob", () => {
  it("re-indexes positions from 0 in source order", () => {
    const result = cloneEquipmentForJob(
      [
        { model: "Screen B", serial: "SB-1", position: 5 },
        { model: "Screen A", serial: "SA-1", position: 1 },
      ],
      "job-2",
    );
    expect(result).toEqual([
      { job_id: "job-2", position: 0, model: "Screen A", serial: "SA-1" },
      { job_id: "job-2", position: 1, model: "Screen B", serial: "SB-1" },
    ]);
  });

  it("returns an empty array for an empty source", () => {
    expect(cloneEquipmentForJob([], "job-3")).toEqual([]);
  });
});
