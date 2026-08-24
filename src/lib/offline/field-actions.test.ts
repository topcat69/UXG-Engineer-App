import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db, type InstallFormRow, type JobDetailsRow } from "./db";
import { saveInstallFormDraft, saveJobDetailsDraft } from "./field-actions";

function jobDetailsRow(overrides: Partial<JobDetailsRow> = {}): JobDetailsRow {
  return {
    id: "details-1",
    job_id: "job-1",
    player_serial: null,
    screen_serial: null,
    mount_type: null,
    power_source: null,
    network_type: null,
    wifi_signal: null,
    network_port: null,
    player_boot_test: null,
    content_displaying: null,
    rams_storage_path: null,
    site_plan_storage_path: null,
    sla_requirement_detail: null,
    job_information: null,
    parking_notes: null,
    parking_notified: null,
    site_manager_name: null,
    site_manager_phone: null,
    reported_to_site_manager: null,
    revisit_required: null,
    issues_found: null,
    issue_detail: null,
    engineer_notes: null,
    submitted_at: null,
    created_at: "2026-08-24T09:00:00Z",
    ...overrides,
  };
}

function installFormRow(overrides: Partial<InstallFormRow> = {}): InstallFormRow {
  return {
    id: "install-1",
    job_id: "job-1",
    player_serial: null,
    screen_serial: null,
    mount_type: null,
    power_source: null,
    network_type: null,
    wifi_signal: null,
    network_port: null,
    player_boot_test: null,
    content_displaying: null,
    issues_found: null,
    issue_detail: null,
    engineer_notes: null,
    client_name: null,
    submitted_at: null,
    created_at: "2026-08-24T09:00:00Z",
    ...overrides,
  };
}

describe("saveJobDetailsDraft / saveInstallFormDraft", () => {
  beforeEach(async () => {
    await db.jobDetails.clear();
    await db.installForms.clear();
    await db.outbox.clear();
  });
  afterEach(async () => {
    await db.jobDetails.clear();
    await db.installForms.clear();
    await db.outbox.clear();
  });

  it("writes the draft row locally", async () => {
    await saveJobDetailsDraft(jobDetailsRow({ player_serial: "PLR-1" }));
    const row = await db.jobDetails.get("details-1");
    expect(row?.player_serial).toBe("PLR-1");
  });

  it("queues a job_details_upsert outbox op so a periodic sync-down can't overwrite the draft", async () => {
    await saveJobDetailsDraft(jobDetailsRow({ player_serial: "PLR-1" }));
    const op = await db.outbox.get("draft-details-job-1");
    expect(op).toMatchObject({ type: "job_details_upsert" });
    if (op?.type === "job_details_upsert") expect(op.row.player_serial).toBe("PLR-1");
  });

  it("reuses the same outbox op id on repeated ticks instead of piling up duplicates", async () => {
    await saveJobDetailsDraft(jobDetailsRow({ player_serial: "PLR-1" }));
    await saveJobDetailsDraft(jobDetailsRow({ player_serial: "PLR-2" }));
    const all = await db.outbox.toArray();
    expect(all).toHaveLength(1);
    const op = await db.outbox.get("draft-details-job-1");
    if (op?.type === "job_details_upsert") expect(op.row.player_serial).toBe("PLR-2");
  });

  it("keeps the outbox op's original createdAt across ticks", async () => {
    await saveJobDetailsDraft(jobDetailsRow({ player_serial: "PLR-1" }));
    const first = await db.outbox.get("draft-details-job-1");
    await saveJobDetailsDraft(jobDetailsRow({ player_serial: "PLR-2" }));
    const second = await db.outbox.get("draft-details-job-1");
    expect(second?.createdAt).toBe(first?.createdAt);
  });

  it("does the same for the legacy install_forms draft path", async () => {
    await saveInstallFormDraft(installFormRow({ player_serial: "PLR-3" }));
    const row = await db.installForms.get("install-1");
    expect(row?.player_serial).toBe("PLR-3");
    const op = await db.outbox.get("draft-install-job-1");
    expect(op).toMatchObject({ type: "install_form_upsert" });
  });
});
