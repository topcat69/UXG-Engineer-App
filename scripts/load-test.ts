#!/usr/bin/env tsx
/**
 * Seeds 500 jobs and 10,000 media_assets rows (PROMPT.md's Phase 7 load
 * target), then times the exact queries the office UI actually runs —
 * dashboard, jobs list, job detail, CSV export, and the engineer's offline
 * sync-down — through a real RLS-scoped session, not the admin client, so
 * the numbers reflect what a real user's browser waits on. Results are
 * printed, not asserted against a threshold: there's no SLA in PROMPT.md
 * to fail a build against, only "does this still feel instant at the
 * stated scale" for a human to read and judge, same as this app's stated
 * scale
 * philosophy generally (see PROMPT.md's "Scale and shape" section).
 *
 * Cleans up everything it inserted by default; pass --keep to leave the
 * data in place for further poking around.
 */
import { createScriptAdminClient } from "./lib/supabase-admin";
import { sessionClientFor } from "./lib/session-client";

const TAG = "LOADTEST";
const JOB_COUNT = 500;
const MEDIA_COUNT = 10_000;
const CHUNK_SIZE = 1000;

const STATUSES = [
  "draft", "scheduled", "dispatched", "in_progress", "submitted",
  "under_review", "approved", "closed", "cancelled",
] as const;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function time<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  const result = await fn();
  const ms = performance.now() - start;
  console.log(`  ${label}: ${ms.toFixed(1)}ms`);
  return result;
}

async function main() {
  const keep = process.argv.includes("--keep");
  const admin = createScriptAdminClient();

  console.log(`Seeding ${JOB_COUNT} jobs and ${MEDIA_COUNT} media_assets rows...`);

  const { data: project } = await admin.from("projects").select("id").limit(1).single();
  const { data: client } = await admin.from("clients").select("id").limit(1).single();
  const { data: engineer } = await admin.from("users").select("id").eq("email", "engineer@opoc.test").single();
  if (!project || !client || !engineer) throw new Error("Seed data missing — run `pnpm db:reset` first.");

  const { data: site, error: siteError } = await admin
    .from("sites")
    .insert({ name: `${TAG} Site`, client_id: client.id })
    .select("id")
    .single();
  if (siteError || !site) throw new Error(`Failed to create load-test site: ${siteError?.message}`);

  const jobRows = Array.from({ length: JOB_COUNT }, (_, i) => ({
    job_number: `${TAG}-${String(i + 1).padStart(5, "0")}`,
    project_id: project.id,
    site_id: site.id,
    job_type: "install",
    status: STATUSES[i % STATUSES.length],
    assigned_to: engineer.id,
    scheduled_start: new Date(Date.now() + i * 60_000).toISOString(),
  }));

  const jobIds: string[] = [];
  for (const batch of chunk(jobRows, CHUNK_SIZE)) {
    const { data, error } = await admin.from("jobs").insert(batch).select("id");
    if (error) throw new Error(`Failed to seed jobs: ${error.message}`);
    jobIds.push(...data.map((j) => j.id));
  }

  const mediaRows = Array.from({ length: MEDIA_COUNT }, (_, i) => ({
    job_id: jobIds[i % jobIds.length],
    slot: `photo_${i % 20}`,
    storage_path: `jobs/${jobIds[i % jobIds.length]}/loadtest-${i}.jpg`,
    media_type: "image" as const,
    bytes: 500_000,
    mime: "image/jpeg",
    captured_at: new Date().toISOString(),
  }));
  for (const batch of chunk(mediaRows, CHUNK_SIZE)) {
    const { error } = await admin.from("media_assets").insert(batch);
    if (error) throw new Error(`Failed to seed media_assets: ${error.message}`);
  }

  console.log("Seed complete.\n\nTiming real queries (RLS-scoped sessions, not the admin client):");

  const manager = await sessionClientFor("manager@opoc.test", admin);
  const engineerSession = await sessionClientFor("engineer@opoc.test", admin);

  await time("dashboard (all non-draft jobs + issues)", async () => {
    await Promise.all([
      manager.from("jobs").select("id, status, parent_job_id, scheduled_start, actual_start, actual_end, assigned_to").neq("status", "draft"),
      manager.from("issues").select("job_id, category, status, revisit_job_id, created_at"),
    ]);
  });

  await time("jobs list, page 1 (50 rows, exact count)", async () => {
    await manager
      .from("jobs")
      .select("id, job_number, job_type, status, priority, scheduled_start, assigned_to, site:sites(name), project:projects(name), assigned:users!jobs_assigned_to_fkey(name)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(0, 49);
  });

  await time("job detail (one job + its media)", async () => {
    await Promise.all([
      manager.from("jobs").select("*, site:sites(*), project:projects(name), assigned:users!jobs_assigned_to_fkey(name)").eq("id", jobIds[0]).single(),
      manager.from("media_assets").select("*").eq("job_id", jobIds[0]).order("slot"),
    ]);
  });

  await time("CSV export query (up to 5000 rows)", async () => {
    await manager
      .from("jobs")
      .select("job_number, status, job_type, priority, scheduled_start, site:sites(name), project:projects(name), assigned:users!jobs_assigned_to_fkey(name)")
      .order("created_at", { ascending: false })
      .limit(5000);
  });

  await time("engineer offline sync-down (their assigned jobs)", async () => {
    await engineerSession.from("jobs").select("*").eq("assigned_to", engineer.id);
  });

  if (!keep) {
    console.log("\nCleaning up...");
    // Deleting by site_id (one simple filter) rather than `.in("id", jobIds)`
    // with 500 UUIDs — the latter blew PostgREST's URL length limit ("URI
    // too long", a real bug this script's own first run caught, since the
    // unchecked delete calls failed silently and left every row behind).
    // media_assets.job_id has ON DELETE CASCADE, so deleting the jobs is
    // enough to take their media_assets rows with them.
    const { error: jobsDeleteError } = await admin.from("jobs").delete().eq("site_id", site.id);
    if (jobsDeleteError) throw new Error(`Cleanup failed deleting jobs: ${jobsDeleteError.message}`);
    const { error: siteDeleteError } = await admin.from("sites").delete().eq("id", site.id);
    if (siteDeleteError) throw new Error(`Cleanup failed deleting site: ${siteDeleteError.message}`);
    console.log("Done.");
  } else {
    console.log(`\nLeft ${JOB_COUNT} jobs and ${MEDIA_COUNT} media_assets rows in place (--keep).`);
  }
}

main().catch((err) => {
  console.error("Load test failed:", err);
  process.exit(1);
});
