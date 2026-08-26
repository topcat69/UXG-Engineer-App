import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db, type InstallFormRow, type JobDetailsRow, type JobRow } from "./db";
import { pauseJob, resumeJob, saveInstallFormDraft, saveJobDetailsDraft, submitJob, submitJobDetails } from "./field-actions";

function jobRow(overrides: Partial<JobRow> = {}): JobRow {
  return {
    id: "job-1",
    job_number: "UXG-2026-0001",
    job_type: "install",
    status: "in_progress",
    site_id: "site-1",
    project_id: null,
    assigned_to: null,
    priority: null,
    description: null,
    parent_job_id: null,
    source_issue_id: null,
    scheduled_start: null,
    scheduled_end: null,
    actual_travel_start: null,
    actual_start: "2026-08-24T09:00:00Z",
    actual_end: null,
    travel_start_lat: null,
    travel_start_lng: null,
    check_in_lat: null,
    check_in_lng: null,
    geofence_variance_m: null,
    media_pending: null,
    calendar_event_id: null,
    email_thread_id: null,
    completion_pdf_url: null,
    qa_status: null,
    qa_notes: null,
    created_at: "2026-08-24T08:00:00Z",
    updated_at: null,
    ...overrides,
  };
}

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
    equipment_damage: null,
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
    equipment_damage: null,
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

describe("submitJob / submitJobDetails", () => {
  beforeEach(async () => {
    await db.jobs.clear();
    await db.jobDetails.clear();
    await db.installForms.clear();
    await db.outbox.clear();
  });
  afterEach(async () => {
    await db.jobs.clear();
    await db.jobDetails.clear();
    await db.installForms.clear();
    await db.outbox.clear();
  });

  it("collapses a stale pre-submission draft op into the final job_details_upsert instead of leaving both queued", async () => {
    await db.jobs.put(jobRow({ status: "in_progress" }));
    // Simulates a stale draft op left behind from an earlier autosave tick
    // that never made it to the server — exactly the shape that used to
    // retry forever once the status_event below landed and RLS locked the
    // job's job_details row against further engineer writes.
    await db.outbox.put({
      id: "draft-details-job-1",
      type: "job_details_upsert",
      row: jobDetailsRow({ reported_to_site_manager: false }),
      createdAt: "2026-08-24T09:00:00Z",
      attempts: 40,
    });

    await submitJobDetails(
      "job-1",
      "delivery",
      jobDetailsRow({ reported_to_site_manager: true, issues_found: false }),
      null,
      "engineer-1",
    );

    const detailsOps = (await db.outbox.toArray()).filter((op) => op.type === "job_details_upsert");
    expect(detailsOps).toHaveLength(1);
    expect(detailsOps[0]!.id).toBe("draft-details-job-1");
    expect(detailsOps[0]!.attempts).toBe(0);
    if (detailsOps[0]!.type === "job_details_upsert") {
      expect(detailsOps[0]!.row.reported_to_site_manager).toBe(true);
      expect(detailsOps[0]!.row.submitted_at).not.toBeNull();
    }
  });

  it("does the same for the legacy install_forms submit path", async () => {
    await db.jobs.put(jobRow({ status: "in_progress" }));
    await db.outbox.put({
      id: "draft-install-job-1",
      type: "install_form_upsert",
      row: installFormRow(),
      createdAt: "2026-08-24T09:00:00Z",
      attempts: 12,
    });

    await submitJob("job-1", installFormRow({ client_name: "Jane Doe" }), null, "engineer-1");

    const installOps = (await db.outbox.toArray()).filter((op) => op.type === "install_form_upsert");
    expect(installOps).toHaveLength(1);
    expect(installOps[0]!.id).toBe("draft-install-job-1");
    expect(installOps[0]!.attempts).toBe(0);
  });
});

describe("pauseJob / resumeJob", () => {
  beforeEach(async () => {
    await db.jobs.clear();
    await db.outbox.clear();
  });
  afterEach(async () => {
    await db.jobs.clear();
    await db.outbox.clear();
  });

  it("sets the job on_hold locally and queues a status_event carrying the required reason", async () => {
    await db.jobs.put(jobRow({ status: "in_progress" }));
    await pauseJob("job-1", "Waiting on parts");

    const job = await db.jobs.get("job-1");
    expect(job?.status).toBe("on_hold");

    const ops = await db.outbox.toArray();
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({
      type: "status_event",
      jobId: "job-1",
      fromStatus: "in_progress",
      toStatus: "on_hold",
      reason: "Waiting on parts",
    });
  });

  it("resumes a paused job back to in_progress, queuing a matching status_event", async () => {
    await db.jobs.put(jobRow({ status: "on_hold" }));
    await resumeJob("job-1");

    const job = await db.jobs.get("job-1");
    expect(job?.status).toBe("in_progress");

    const ops = await db.outbox.toArray();
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({
      type: "status_event",
      jobId: "job-1",
      fromStatus: "on_hold",
      toStatus: "in_progress",
    });
  });

  it("throws rather than silently no-op-ing when the job isn't in Dexie yet", async () => {
    await expect(pauseJob("missing-job", "Reason")).rejects.toThrow("Job not found locally");
    await expect(resumeJob("missing-job")).rejects.toThrow("Job not found locally");
  });
});
