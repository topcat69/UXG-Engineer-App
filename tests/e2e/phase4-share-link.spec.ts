import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import type { Database } from "@/lib/supabase/database.types";
import { loginAs } from "./helpers/mailpit-login";
import { TINY_PNG_BASE64 } from "./fixtures/tiny-photo";

// Proves Phase 4's own acceptance criterion from PROMPT.md: "a share link
// opens on a phone with no account and leaks nothing beyond that job." A
// fresh, cookie-less browser context stands in for "no account" — it never
// authenticates, the same as a phone that's never seen this app before.

function adminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

test("a manager-created share link opens with no account and shows only that job's approved photos", async ({
  page,
  browser,
}) => {
  test.setTimeout(60_000);
  const admin = adminClient();
  const tag = `E2E-SHARE-${Date.now()}`;

  const { data: site } = await admin
    .from("sites")
    .select("id")
    .limit(1)
    .single();
  const { data: project } = await admin.from("projects").select("id").limit(1).single();

  // A second, unrelated job — proves the share page doesn't leak anything
  // about it even though both jobs share a site/project.
  const otherTag = `E2E-SHARE-OTHER-${Date.now()}`;
  await admin
    .from("jobs")
    .insert({
      job_number: otherTag,
      project_id: project!.id,
      site_id: site!.id,
      job_type: "install",
      status: "submitted",
      qa_notes: "SECRET_INTERNAL_NOTE_OTHER_JOB",
    })
    .select("id")
    .single();

  const { data: job } = await admin
    .from("jobs")
    .insert({
      job_number: tag,
      project_id: project!.id,
      site_id: site!.id,
      job_type: "install",
      status: "closed",
      qa_status: "approved",
      qa_notes: "SECRET_INTERNAL_QA_NOTE",
      scheduled_start: new Date().toISOString(),
    })
    .select("id")
    .single();
  const jobId = job!.id;

  // A real uploaded photo, so the share page's signed-URL path is exercised
  // for real rather than gracefully failing on a missing object.
  const photoBuffer = Buffer.from(TINY_PNG_BASE64, "base64");
  const storagePath = `jobs/${jobId}/photo_before.jpg`;
  await admin.storage.from("media").upload(storagePath, photoBuffer, { contentType: "image/jpeg" });
  await admin.from("media_assets").insert({
    job_id: jobId,
    slot: "photo_before",
    storage_path: storagePath,
    media_type: "image",
    bytes: photoBuffer.length,
    mime: "image/jpeg",
    captured_at: new Date().toISOString(),
  });

  // --- Drive the actual office UI, as a manager, to create the link. ---
  await loginAs(page, "manager@opoc.test");
  await page.goto(`/office/jobs/${jobId}`);
  await page.getByRole("button", { name: "Create share link" }).click();
  const codeLocator = page.locator("code").last();
  await expect(codeLocator).toContainText("/share/");
  const shareUrl = (await codeLocator.textContent())!.trim();

  // --- Open it from a browser context that has never signed in. ---
  const anonContext = await browser.newContext();
  const anonPage = await anonContext.newPage();
  await anonPage.goto(shareUrl);

  await expect(anonPage.getByRole("heading", { name: tag })).toBeVisible();
  await expect(anonPage.locator("img")).toHaveCount(1, { timeout: 10_000 });

  const bodyText = await anonPage.locator("body").innerText();
  expect(bodyText).not.toContain("SECRET_INTERNAL_QA_NOTE");
  expect(bodyText).not.toContain("SECRET_INTERNAL_NOTE_OTHER_JOB");
  expect(bodyText).not.toContain(otherTag);

  // No account was ever created for this context — it's still not
  // authenticated for anything else in the app.
  await anonPage.goto("/office/jobs");
  await expect(anonPage).toHaveURL(/\/login/);

  await anonContext.close();
});

test("an expired or revoked share link shows 'not available', not the job", async ({ browser }) => {
  const admin = adminClient();
  const { data: site } = await admin.from("sites").select("id").limit(1).single();
  const { data: project } = await admin.from("projects").select("id").limit(1).single();
  const { data: job } = await admin
    .from("jobs")
    .insert({
      job_number: `E2E-SHARE-EXPIRED-${Date.now()}`,
      project_id: project!.id,
      site_id: site!.id,
      job_type: "install",
      status: "closed",
      qa_status: "approved",
    })
    .select("id")
    .single();

  const expiredToken = `expired-${Date.now()}`;
  const revokedToken = `revoked-${Date.now()}`;
  await admin.from("share_links").insert([
    { token: expiredToken, job_id: job!.id, expires_at: new Date(Date.now() - 86_400_000).toISOString() },
    { token: revokedToken, job_id: job!.id, expires_at: new Date(Date.now() + 86_400_000).toISOString(), revoked: true },
  ]);

  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`/share/${expiredToken}`);
  await expect(page.getByText("Link not available")).toBeVisible();

  await page.goto(`/share/${revokedToken}`);
  await expect(page.getByText("Link not available")).toBeVisible();

  await page.goto(`/share/this-token-does-not-exist`);
  await expect(page.getByText("Link not available")).toBeVisible();

  await context.close();
});
