import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { PDFParse } from "pdf-parse";
import JSZip from "jszip";
import type { Database } from "@/lib/supabase/database.types";
import { loginAs } from "./helpers/mailpit-login";
import { TINY_PNG_BASE64 } from "./fixtures/tiny-photo";

// Proves the on-demand report feature end to end: a manager can find a job
// on /office/reports and pull both a real PDF and a real zip archive
// (media + signatures + the same PDF), generated fresh rather than reused
// from jobs.completion_pdf_url — this job is never QA-approved, so that
// column stays null the whole test.

function adminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

test("manager pulls a job's PDF and zip report from /office/reports", async ({ page }) => {
  test.setTimeout(90_000);
  const admin = adminClient();
  const tag = `E2E-REPORT-${Date.now()}`;

  const { data: engineer } = await admin.from("users").select("id").eq("email", "engineer@opoc.test").single();
  const { data: site } = await admin.from("sites").select("id, latitude, longitude").limit(1).single();
  const { data: project } = await admin.from("projects").select("id").limit(1).single();
  const { data: job } = await admin
    .from("jobs")
    .insert({
      job_number: tag,
      project_id: project!.id,
      site_id: site!.id,
      job_type: "install",
      status: "dispatched",
      assigned_to: engineer!.id,
      scheduled_start: new Date().toISOString(),
    })
    .select("id")
    .single();
  const jobId = job!.id;

  await page.context().grantPermissions(["geolocation"]);
  await page.context().setGeolocation({ latitude: site!.latitude ?? 51.5, longitude: site!.longitude ?? -0.1 });

  // --- Field: check in, fill the form, capture a photo and signature, submit clean. ---
  await loginAs(page, "engineer@opoc.test");
  await page.getByText(tag).click();
  await page.getByRole("button", { name: "Start Travelling" }).click({ force: true });
  await expect(page.getByRole("button", { name: /Check In/ })).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: /Check In/ }).click();
  await expect(page.getByText("In Progress")).toBeVisible();

  await page.locator("label", { hasText: "Player serial" }).locator("input").fill("PLR-REPORT-1");
  await page.locator("label", { hasText: "Screen serial" }).locator("input").fill("SCR-REPORT-1");
  async function selectByLabel(labelText: string, optionText: string) {
    await page.locator("label", { hasText: labelText }).locator("select").selectOption({ label: optionText });
  }
  await selectByLabel("Mount type", "Wall");
  await selectByLabel("Power source", "Existing socket");
  await selectByLabel("Network", "Ethernet");
  await selectByLabel("Player boot test", "Pass");
  await selectByLabel("Content displaying", "Pass");
  await page.getByRole("button", { name: "Yes", exact: true }).nth(1).click(); // 2nd Yes/No pair in DOM order: Parking notified (0), Reported to site manager (1)
  await selectByLabel("Equipment damage", "N/A");

  const photoBuffer = Buffer.from(TINY_PNG_BASE64, "base64");
  const fileInputs = page.locator('input[type="file"]');
  const slotCount = await fileInputs.count();
  for (let i = 0; i < slotCount; i++) {
    await fileInputs.nth(i).setInputFiles({ name: `photo-${i}.png`, mimeType: "image/png", buffer: photoBuffer });
  }
  await page.waitForFunction(
    () =>
      Array.from(document.querySelectorAll('button[aria-label^="Capture photo"]')).every((b) =>
        b.textContent?.includes("✅"),
      ),
    { timeout: 20_000 },
  );

  const canvas = page.locator("canvas");
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + 100, box.y + 60, { steps: 5 });
  await page.mouse.up();
  await page.getByRole("button", { name: "Save signature" }).click();
  await expect(page.getByText("Signature captured")).toBeVisible();

  await page.getByRole("button", { name: /Check Out & Submit/ }).click();
  await expect(page.getByText("This job is submitted.")).toBeVisible({ timeout: 10_000 });

  // The Reports page only lists closed/cancelled jobs (a report only makes
  // sense once a job is actually finished) — moved straight to "closed"
  // rather than going through full QA approval, since this test is about
  // the report download itself, not the QA workflow, and completion_pdf_url
  // must stay null either way to prove the PDF/zip generate fresh.
  await admin.from("jobs").update({ status: "closed" }).eq("id", jobId);

  // --- Office: find the job on the Reports page (never QA-approved). ---
  const officePage = await page.context().browser()!.newPage();
  await loginAs(officePage, "manager@opoc.test");
  await officePage.goto(`/office/reports?q=${tag}`);
  const row = officePage.locator("tr", { hasText: tag });
  await expect(row).toBeVisible();

  const { data: preApproval } = await admin.from("jobs").select("completion_pdf_url").eq("id", jobId).single();
  expect(preApproval?.completion_pdf_url).toBeNull();

  // --- Download and verify the real PDF. ---
  const [pdfDownload] = await Promise.all([officePage.waitForEvent("download"), row.getByRole("link", { name: "PDF" }).click()]);
  const pdfPath = await pdfDownload.path();
  const pdfBytes = fs.readFileSync(pdfPath!);
  expect(pdfBytes.subarray(0, 5).toString()).toBe("%PDF-");

  const parser = new PDFParse({ data: pdfBytes });
  const parsed = await parser.getText();
  await parser.destroy();
  expect(parsed.text).toContain(tag);
  expect(parsed.text).toContain("PLR-REPORT-1");

  // --- Download and verify the real zip: PDF + media + signature inside. ---
  const [zipDownload] = await Promise.all([officePage.waitForEvent("download"), row.getByRole("link", { name: "Zip" }).click()]);
  const zipPath = await zipDownload.path();
  const zipBytes = fs.readFileSync(zipPath!);
  expect(zipBytes.subarray(0, 2).toString()).toBe("PK");

  const zip = await JSZip.loadAsync(zipBytes);
  const names = Object.keys(zip.files);
  expect(names.some((n) => n.endsWith("-report.pdf"))).toBe(true);
  expect(names.some((n) => n.startsWith("media/"))).toBe(true);
  expect(names.some((n) => n.startsWith("signatures/"))).toBe(true);

  await officePage.close();
});
