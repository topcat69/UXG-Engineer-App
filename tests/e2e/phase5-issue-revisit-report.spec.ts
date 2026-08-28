import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { PDFParse } from "pdf-parse";
import type { Database } from "@/lib/supabase/database.types";
import { loginAs } from "./helpers/mailpit-login";
import { TINY_PNG_BASE64 } from "./fixtures/tiny-photo";

// Proves Phase 5's own acceptance criterion from PROMPT.md: "a failed check
// produces an issue, a linked revisit job, and a PDF that would stand up as
// evidence." Drives the field submit through the real UI (a real fail
// answer, not a direct DB insert) so the whole chain — form -> outbox ->
// PostgREST -> pg_net trigger -> webhook -> revisit job — is exercised for
// real, then drives the office QA approval through the real UI too, and
// finally downloads and parses the actual generated PDF bytes.

function adminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

test("a failed check produces a blocking issue, a linked revisit job, and approving produces a real completion PDF", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const admin = adminClient();
  const tag = `E2E-P5-${Date.now()}`;

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

  // --- Field: check in, deliberately fail the boot test, submit. ---
  await loginAs(page, "engineer@opoc.test");
  await page.getByText(tag).click();
  await page.getByRole("button", { name: "Start Travelling" }).click({ force: true });
  await expect(page.getByRole("button", { name: /Check In/ })).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: /Check In/ }).click();
  await expect(page.getByText("In Progress")).toBeVisible();

  await page.locator("label", { hasText: "Player serial" }).locator("input").fill("PLR-P5-1");
  await page.locator("label", { hasText: "Screen serial" }).locator("input").fill("SCR-P5-1");
  async function selectByLabel(labelText: string, optionText: string) {
    await page.locator("label", { hasText: labelText }).locator("select").selectOption({ label: optionText });
  }
  await selectByLabel("Mount type", "Wall");
  await selectByLabel("Power source", "Existing socket");
  await selectByLabel("Network", "Ethernet");
  await selectByLabel("Player boot test", "Fail"); // the deliberate failure this whole test is about
  await selectByLabel("Content displaying", "Pass");
  await page.locator("label", { hasText: "Reported to site manager" }).getByRole("button", { name: "Yes" }).click();
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

  // --- The issue, and its linked revisit, are created by the DB webhook,
  // asynchronously relative to the submit — poll rather than assume timing. ---
  let issue: { id: string; revisit_job_id: string | null; blocks_completion: boolean | null } | null = null;
  await expect
    .poll(
      async () => {
        const { data } = await admin
          .from("issues")
          .select("id, revisit_job_id, blocks_completion")
          .eq("job_id", jobId)
          .eq("description", "Player boot test failed.")
          .maybeSingle();
        issue = data;
        return !!data?.revisit_job_id;
      },
      { timeout: 15_000, message: "waiting for the blocking issue's revisit job to be linked" },
    )
    .toBe(true);

  expect(issue!.blocks_completion).toBe(true);
  const { data: revisit } = await admin
    .from("jobs")
    .select("parent_job_id, site_id, project_id, job_type, status")
    .eq("id", issue!.revisit_job_id!)
    .single();
  expect(revisit).toMatchObject({
    parent_job_id: jobId,
    site_id: site!.id,
    project_id: project!.id,
    job_type: "install",
    status: "draft",
  });

  // --- Office: approve the original job, generating the completion PDF. ---
  const officePage = await page.context().browser()!.newPage();
  await loginAs(officePage, "manager@opoc.test");
  await officePage.goto("/office/qa");
  const jobRow = officePage.locator('[data-testid="qa-row"]', { hasText: tag });
  await jobRow.getByRole("button", { name: "Approve" }).click();
  // The success message is transient — router.refresh() re-fetches the QA
  // queue right after, and the row (now closed, no longer submitted/
  // under_review) unmounts as part of that same refresh, often before a
  // toast assertion can catch it. Wait for the row's departure instead,
  // which is the real signal the action completed.
  await expect(jobRow).toBeHidden({ timeout: 15_000 });

  // --- Fetch the real generated PDF and verify its actual content. ---
  let pdfPath: string | null = null;
  await expect
    .poll(
      async () => {
        const { data } = await admin.from("jobs").select("completion_pdf_url").eq("id", jobId).single();
        pdfPath = data?.completion_pdf_url ?? null;
        return !!pdfPath;
      },
      { timeout: 15_000, message: "waiting for completion_pdf_url to be set" },
    )
    .toBe(true);

  const { data: signed } = await admin.storage.from("media").createSignedUrl(pdfPath!, 60);
  const response = await fetch(signed!.signedUrl);
  expect(response.ok).toBe(true);
  const pdfBytes = Buffer.from(await response.arrayBuffer());
  expect(pdfBytes.subarray(0, 5).toString()).toBe("%PDF-");
  expect(pdfBytes.length).toBeGreaterThan(1000);

  const parser = new PDFParse({ data: pdfBytes });
  const parsed = await parser.getText();
  await parser.destroy();
  expect(parsed.text).toContain(tag); // job number
  expect(parsed.text).toContain("PLR-P5-1"); // form answer
  expect(parsed.text).toContain("Player boot test failed."); // the issue itself
  expect(parsed.text).toContain("Hash manifest");
  expect(parsed.text).toMatch(/[0-9a-f]{64}/); // an actual sha256 hex digest in the manifest

  await officePage.close();
});
