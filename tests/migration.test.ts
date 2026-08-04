import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient } from "./helpers/rls-test-client";
import { runMigration } from "../scripts/lib/run-migration";
import { importMediaFromManifest } from "../scripts/lib/media-import";
import { buildLookup } from "@/lib/migration/csv-helpers";

// Proves Phase 7's own acceptance criterion from PROMPT.md: "a full
// AppSheet export imports cleanly with media intact and job history
// preserved." Runs the exact same code the CLI scripts
// (scripts/migrate-appsheet.ts, scripts/migrate-media.ts) run, against a
// real local Supabase — a synthetic export directory in, real rows and a
// real Storage object out, checked here rather than assumed from the
// parsers' own unit tests.

const admin = adminClient();
const TAG = `MIG-TEST-${Date.now()}`;
let exportDir: string;
let mediaDir: string;
const createdJobIds: string[] = [];
const createdUserIds: string[] = [];

beforeAll(async () => {
  exportDir = fs.mkdtempSync(path.join(os.tmpdir(), "appsheet-export-"));
  mediaDir = fs.mkdtempSync(path.join(os.tmpdir(), "appsheet-media-"));

  fs.writeFileSync(
    path.join(exportDir, "users.csv"),
    `email,name,role\n${TAG.toLowerCase()}@example.com,${TAG} Engineer,engineer`,
  );
  fs.writeFileSync(path.join(exportDir, "projects.csv"), `name,client_name\n${TAG} Rollout,Acme Retail`);
  fs.writeFileSync(path.join(exportDir, "sites.csv"), `name,town\n${TAG} Store,Oldtown`);
  fs.writeFileSync(
    path.join(exportDir, "jobs.csv"),
    "job_number,project_name,site_name,job_type,status,assigned_to_email,actual_start,actual_end,created_at\n" +
      `${TAG}-0001,${TAG} Rollout,${TAG} Store,install,closed,${TAG.toLowerCase()}@example.com,2023-02-05T09:10:00Z,2023-02-05T11:00:00Z,2023-02-01T00:00:00Z`,
  );
  fs.writeFileSync(
    path.join(exportDir, "issues.csv"),
    `severity,description,job_number\nlow,${TAG} legacy issue,${TAG}-0001`,
  );

  const fileBytes = Buffer.from(`${TAG} fake jpeg bytes`);
  fs.writeFileSync(path.join(mediaDir, "photo.jpg"), fileBytes);
  fs.writeFileSync(
    path.join(mediaDir, "media.csv"),
    "job_number,slot,filename,latitude,longitude,captured_at,caption\n" +
      `${TAG}-0001,photo_before,photo.jpg,52.1,-1.1,2023-02-05T09:05:00Z,${TAG} entrance`,
  );
}, 30_000);

afterAll(async () => {
  if (createdJobIds.length > 0) {
    // issues.job_id has no ON DELETE CASCADE (unlike status_events/media_assets),
    // so it has to go first or the job delete hits a foreign key violation.
    await admin.from("issues").delete().in("job_id", createdJobIds);
    await admin.from("jobs").delete().in("id", createdJobIds);
  }
  await admin.from("projects").delete().eq("name", `${TAG} Rollout`);
  await admin.from("sites").delete().eq("name", `${TAG} Store`);
  for (const userId of createdUserIds) {
    // public.users.id -> auth.users(id) has no ON DELETE CASCADE, so
    // deleting the auth user first would just fail (RESTRICT) — delete
    // the profile row first, same ordering reason as issues above.
    await admin.from("users").delete().eq("id", userId);
    await admin.auth.admin.deleteUser(userId);
  }
  fs.rmSync(exportDir, { recursive: true, force: true });
  fs.rmSync(mediaDir, { recursive: true, force: true });
}, 30_000);

describe("AppSheet data + media migration", () => {
  it("imports every table, preserving historical status/timestamps, and records a migration status_event", async () => {
    const { counts, errors } = await runMigration(exportDir, admin);
    expect(errors).toEqual([]);
    expect(counts).toMatchObject({ users: 1, projects: 1, sites: 1, jobs: 1, issues: 1 });

    const { data: job } = await admin
      .from("jobs")
      .select("id, status, created_at, actual_start, actual_end")
      .eq("job_number", `${TAG}-0001`)
      .single();
    expect(job).toBeTruthy();
    createdJobIds.push(job!.id);

    // Preserved, not reset to "draft"/"now" — this is the whole point of a
    // migration versus a fresh job creation.
    expect(job!.status).toBe("closed");
    expect(job!.created_at).toBe("2023-02-01T00:00:00+00:00");
    expect(job!.actual_start).toBe("2023-02-05T09:10:00+00:00");
    expect(job!.actual_end).toBe("2023-02-05T11:00:00+00:00");

    const { data: events } = await admin.from("status_events").select("from_status, to_status, reason").eq("job_id", job!.id);
    expect(events).toEqual([{ from_status: null, to_status: "closed", reason: "Migrated from AppSheet import" }]);

    const { data: issue } = await admin.from("issues").select("description").eq("job_id", job!.id).single();
    expect(issue?.description).toBe(`${TAG} legacy issue`);

    const { data: user } = await admin.from("users").select("id, name, role").eq("email", `${TAG.toLowerCase()}@example.com`).single();
    expect(user).toMatchObject({ name: `${TAG} Engineer`, role: "engineer" });
    createdUserIds.push(user!.id);
  });

  it("copies the referenced media file into Storage with metadata intact, byte-for-byte", async () => {
    const { data: job } = await admin.from("jobs").select("id").eq("job_number", `${TAG}-0001`).single();
    const jobLookup = buildLookup([{ key: `${TAG}-0001`, id: job!.id }]);
    const { data: user } = await admin.from("users").select("id").eq("email", `${TAG.toLowerCase()}@example.com`).single();
    const userLookup = buildLookup([{ key: `${TAG.toLowerCase()}@example.com`, id: user!.id }]);

    const { imported, errors } = await importMediaFromManifest(mediaDir, admin, jobLookup, userLookup);
    expect(errors).toEqual([]);
    expect(imported).toBe(1);

    const { data: mediaAsset } = await admin
      .from("media_assets")
      .select("storage_path, media_type, latitude, longitude, caption, sha256, bytes")
      .eq("job_id", job!.id)
      .single();
    expect(mediaAsset).toMatchObject({ media_type: "image", latitude: 52.1, longitude: -1.1, caption: `${TAG} entrance` });

    const expectedBytes = fs.readFileSync(path.join(mediaDir, "photo.jpg"));
    expect(mediaAsset!.sha256).toBe(crypto.createHash("sha256").update(expectedBytes).digest("hex"));
    expect(mediaAsset!.bytes).toBe(expectedBytes.length);

    // Not just a DB row — the object is really in Storage, with the exact bytes.
    const { data: downloaded, error: downloadError } = await admin.storage.from("media").download(mediaAsset!.storage_path);
    expect(downloadError).toBeNull();
    const downloadedBytes = Buffer.from(await downloaded!.arrayBuffer());
    expect(downloadedBytes.equals(expectedBytes)).toBe(true);
  });
});
