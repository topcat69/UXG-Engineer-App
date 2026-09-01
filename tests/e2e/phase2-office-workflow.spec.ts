import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import type { Database } from "@/lib/supabase/database.types";
import { loginAs } from "./helpers/mailpit-login";

// Proves Phase 2's own acceptance criterion from PROMPT.md: "a manager can
// import 50 sites from CSV, generate 50 jobs, bulk assign and schedule them"
// — end to end, through the real UI, against a real local Postgres (no
// mocks). Runs against whatever seed/prior state the DB already has, so it
// verifies via a unique tag per run rather than assuming exact row counts.

function adminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

test("manager imports sites, generates jobs, and bulk assigns/schedules them", async ({ page }) => {
  const tag = `E2E-${Date.now()}`;
  const admin = adminClient();

  const csvPath = path.join(os.tmpdir(), `${tag}.csv`);
  const header = "name,address_line1,town,postcode,latitude,longitude,organisation";
  const rows = Array.from({ length: 50 }, (_, i) => {
    const n = i + 1;
    return `${tag} Site ${n},${n} Church Road,Newtown,NT${n} 2BB,${(52 + n * 0.001).toFixed(4)},${(-1 + n * 0.001).toFixed(4)},Acme Retail`;
  });
  fs.writeFileSync(csvPath, [header, ...rows].join("\n"));

  await loginAs(page, "manager@opoc.test");

  // Step 1: import 50 sites.
  await page.goto("/office/import");
  await page.locator('select[name="clientId"]').selectOption({ label: "Acme Retail" });
  await page.setInputFiles('input[type="file"]', csvPath);
  await page.getByRole("button", { name: "Import" }).click();
  await expect(page.getByText("Imported 50 site(s).")).toBeVisible({ timeout: 15_000 });

  const { data: importedSites, error: sitesError } = await admin
    .from("sites")
    .select("id")
    .like("name", `${tag}%`);
  expect(sitesError).toBeNull();
  expect(importedSites).toHaveLength(50);

  // Step 2: generate 50 jobs against those sites.
  const { data: project } = await admin.from("projects").select("id").limit(1).single();
  await page.getByLabel("Project").selectOption(project!.id);
  await page.getByLabel("Job type").selectOption("install");
  await page.getByRole("button", { name: /Generate 50 job/ }).click();
  await expect(page.getByText("Generated 50 job(s).")).toBeVisible({ timeout: 15_000 });

  const siteIds = (importedSites ?? []).map((s) => s.id);
  const { data: generatedJobs, error: jobsError } = await admin
    .from("jobs")
    .select("id, status, assigned_to")
    .in("site_id", siteIds);
  expect(jobsError).toBeNull();
  expect(generatedJobs).toHaveLength(50);
  expect(generatedJobs?.every((j) => j.status === "draft")).toBe(true);

  // Step 3: bulk assign + bulk schedule via the job list, filtered to just
  // the sites this run created isn't possible through the UI's filters, so
  // scope by status=draft (fresh jobs are the only draft ones with these
  // site ids — verified independently above) and act on the whole page.
  await page.goto("/office/jobs?status=draft");
  await page.waitForSelector("table");
  await page.locator('thead [role="checkbox"]').click();
  await expect(page.getByText(/selected/)).toBeVisible();

  const { data: engineer } = await admin.from("users").select("id").eq("email", "engineer@opoc.test").single();
  await page.getByLabel("Assign to").selectOption(engineer!.id);
  await page.getByRole("button", { name: "Assign" }).click();
  await expect(page.getByText(/^Assigned \d+ job\(s\)\.$/)).toBeVisible({ timeout: 15_000 });

  await page.getByLabel("Scheduled start").fill("2026-09-01");
  await page.getByRole("button", { name: "Schedule" }).click();
  await expect(page.getByText(/^Scheduled \d+ job\(s\)\.$/)).toBeVisible({ timeout: 15_000 });

  const { data: finalJobs, error: finalError } = await admin
    .from("jobs")
    .select("status, assigned_to, scheduled_start")
    .in("site_id", siteIds);
  expect(finalError).toBeNull();
  expect(finalJobs).toHaveLength(50);
  for (const job of finalJobs ?? []) {
    expect(job.status).toBe("scheduled");
    expect(job.assigned_to).toBe(engineer!.id);
    expect(job.scheduled_start?.startsWith("2026-09-01")).toBe(true);
  }

  fs.unlinkSync(csvPath);
});
