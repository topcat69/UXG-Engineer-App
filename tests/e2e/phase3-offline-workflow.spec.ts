import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import type { Database } from "@/lib/supabase/database.types";
import { loginAs } from "./helpers/mailpit-login";
import { TINY_PNG_BASE64 } from "./fixtures/tiny-photo";

// Proves Phase 3's own acceptance criterion from PROMPT.md: "a full
// airplane-mode run — open job, complete form, capture six photos, sign,
// submit — succeeds, survives a force-quit mid-form, and syncs correctly on
// reconnect", with the network genuinely disabled (context.setOffline),
// not mocked at the app layer.

function adminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

test("engineer completes a job entirely offline, survives a reload mid-form, and syncs on reconnect", async ({
  page,
  context,
}) => {
  test.setTimeout(90_000);

  const tag = `E2E-OFFLINE-${Date.now()}`;
  const admin = adminClient();

  // Give this run its own job so it doesn't depend on — or disturb — seed
  // data shared with other tests.
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

  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({
    latitude: site!.latitude ?? 51.5,
    longitude: site!.longitude ?? -0.1,
  });

  // --- Online: sign in and let the initial sync-down populate Dexie. ---
  await loginAs(page, "engineer@opoc.test");
  await expect(page.getByText(tag)).toBeVisible({ timeout: 15_000 });

  // --- Go fully offline: real network disabled at the browser level. ---
  await context.setOffline(true);

  await page.getByText(tag).click();
  await page.getByRole("button", { name: "Start Travelling" }).click({ force: true });
  await expect(page.getByRole("button", { name: /Check In/ })).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: /Check In/ }).click();
  await expect(page.getByText("In Progress")).toBeVisible();

  // Fill part of the form, then wait for the 15s autosave to land in Dexie.
  await page.locator("label", { hasText: "Player serial" }).locator("input").fill("PLR-OFFLINE-1");
  await page.locator("label", { hasText: "Screen serial" }).locator("input").fill("SCR-OFFLINE-1");
  await page.waitForTimeout(16_000);

  // --- Simulate a force-quit mid-form: reload wipes all in-memory state; only
  // what actually made it into IndexedDB survives. ---
  await page.reload();
  await expect(page.getByText(tag)).toBeVisible({ timeout: 15_000 });
  await page.getByText(tag).click();
  await expect(page.locator("label", { hasText: "Player serial" }).locator("input")).toHaveValue("PLR-OFFLINE-1");
  await expect(page.locator("label", { hasText: "Screen serial" }).locator("input")).toHaveValue("SCR-OFFLINE-1");

  // Finish the form.
  async function selectByLabel(labelText: string, optionText: string) {
    await page.locator("label", { hasText: labelText }).locator("select").selectOption({ label: optionText });
  }
  await selectByLabel("Mount type", "Wall");
  await selectByLabel("Power source", "Existing socket");
  await selectByLabel("Network", "Ethernet");
  await selectByLabel("Player boot test", "Pass");
  await selectByLabel("Content displaying", "Pass");
  await page.locator("label", { hasText: "Client name" }).locator("input").fill("Offline Client");

  // Capture all six required photos from a local fixture — the camera
  // `capture` attribute is just a hint; no real camera is needed offline.
  const photoBuffer = Buffer.from(TINY_PNG_BASE64, "base64");
  const fileInputs = page.locator('input[type="file"]');
  const slotCount = await fileInputs.count();
  expect(slotCount).toBe(6);
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

  // Sign.
  const canvas = page.locator("canvas");
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + 100, box.y + 60, { steps: 5 });
  await page.mouse.move(box.x + 160, box.y + 20, { steps: 5 });
  await page.mouse.up();
  await page.getByRole("button", { name: "Save signature" }).click();
  await expect(page.getByText("Signature captured")).toBeVisible();

  // Submit — must succeed entirely offline.
  await page.getByRole("button", { name: /Check Out & Submit/ }).click();
  await expect(page.getByText("This job is submitted.")).toBeVisible({ timeout: 10_000 });

  // Nothing has reached the server yet: prove it via the real network,
  // not just the UI.
  const { data: stillDispatched } = await admin.from("jobs").select("status").eq("id", jobId).single();
  expect(stillDispatched?.status).toBe("dispatched");

  // The outbox must honestly reflect unsynced work.
  await expect(page.getByRole("button", { name: /unsent/ })).toBeVisible();

  // --- Reconnect and sync. ---
  await context.setOffline(false);
  await page.getByRole("button", { name: /unsent/ }).click();
  await page.getByRole("button", { name: "Retry now" }).click();
  await expect(page.getByText("Everything is synced.")).toBeVisible({ timeout: 20_000 });

  const { data: finalJob } = await admin
    .from("jobs")
    .select("status, media_pending")
    .eq("id", jobId)
    .single();
  expect(finalJob?.status).toBe("submitted");
  expect(finalJob?.media_pending).toBe(0);

  const { data: form } = await admin
    .from("install_forms")
    .select("player_serial, screen_serial, client_name, submitted_at")
    .eq("job_id", jobId)
    .single();
  expect(form?.player_serial).toBe("PLR-OFFLINE-1");
  expect(form?.screen_serial).toBe("SCR-OFFLINE-1");
  expect(form?.client_name).toBe("Offline Client");
  expect(form?.submitted_at).not.toBeNull();

  const { data: media } = await admin.from("media_assets").select("id").eq("job_id", jobId);
  expect(media).toHaveLength(6);

  const { data: signatures } = await admin.from("signatures").select("id").eq("job_id", jobId);
  expect(signatures).toHaveLength(1);

  const { data: events } = await admin
    .from("status_events")
    .select("from_status, to_status")
    .eq("job_id", jobId)
    .order("occurred_at");
  expect(events?.map((e) => e.to_status)).toEqual(["travelling", "in_progress", "submitted"]);
});
