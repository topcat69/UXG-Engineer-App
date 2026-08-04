import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import type { Database } from "@/lib/supabase/database.types";
import { loginAs } from "./helpers/mailpit-login";

// Proves Phase 6's own acceptance criterion from PROMPT.md: "a status
// change on a phone appears on the dashboard within two seconds with no
// refresh." The status change is made directly via the admin client —
// standing in for "a phone", whose own field-app write path (Dexie outbox
// -> PostgREST) is already covered end-to-end by the Phase 3 and 5 E2E
// specs. What this test is actually verifying is specific to this phase:
// does Supabase Realtime push the change to an already-open dashboard, and
// does the page pick it up without reloading.

function adminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

test("a status change appears on the dashboard within two seconds with no page refresh", async ({ page }) => {
  test.setTimeout(60_000);
  const admin = adminClient();
  const tag = `E2E-P6-${Date.now()}`;

  const { data: engineer } = await admin.from("users").select("id").eq("email", "engineer@opoc.test").single();
  const { data: site } = await admin.from("sites").select("id").limit(1).single();
  const { data: project } = await admin.from("projects").select("id").limit(1).single();
  const { data: job } = await admin
    .from("jobs")
    .insert({
      job_number: tag,
      project_id: project!.id,
      site_id: site!.id,
      job_type: "install",
      status: "scheduled",
      assigned_to: engineer!.id,
      scheduled_start: new Date().toISOString(),
      scheduled_end: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    })
    .select("id")
    .single();
  const jobId = job!.id;

  await loginAs(page, "manager@opoc.test");
  await page.goto("/office/dashboard");
  await expect(page.getByTestId("dashboard")).toBeVisible();

  // Warm up the Realtime tenant's replication connection before timing the
  // real assertion below. Immediately after a fresh `supabase db reset`,
  // Supabase Realtime lazily creates its WAL replication slot on the first
  // subscribe, which takes a few seconds to come fully online (confirmed
  // via `docker logs supabase_realtime_Test`: "Starting stream replication"
  // to the tenant reporting ready is ~2.3s on a cold slot). That one-time
  // local-dev cold-start cost can eat into the 2-second budget on the very
  // first change after a reset, even though the app's own code path is
  // instant — it doesn't reflect production, where the tenant connection
  // is already warm from ongoing use. A single untimed write can still
  // race the tenant's own init and land before replication is live (and
  // get silently dropped), so retry it until the dashboard actually
  // reflects a change, rather than firing once and hoping.
  await expect
    .poll(
      async () => {
        await admin.from("jobs").update({ description: `warm-up-${Date.now()}` }).eq("id", jobId);
        return page.getByTestId("dashboard-updated").textContent();
      },
      { timeout: 20_000, intervals: [1_000] },
    )
    .not.toBe("Live");

  const statTile = page.getByTestId("stat-completed-vs-scheduled");
  const baselineText = (await statTile.textContent())!.trim();
  const [baselineCompleted, baselineScheduled] = baselineText.split(" / ").map(Number);
  const expectedText = `${baselineCompleted + 1} / ${baselineScheduled - 1}`;

  // Marks this page instance so a full reload (which would reset any JS
  // global) is distinguishable from an in-place Realtime-driven re-render.
  await page.evaluate(() => {
    (window as unknown as { __noReload: boolean }).__noReload = true;
  });

  // The status change itself — the thing "on the phone" in the spec's
  // wording. Timed from here.
  const changedAt = Date.now();
  await admin.from("jobs").update({ status: "closed" }).eq("id", jobId);

  await expect(statTile).toHaveText(expectedText, { timeout: 2_000 });
  const elapsedMs = Date.now() - changedAt;
  expect(elapsedMs).toBeLessThan(2_000);

  const stillNoReload = await page.evaluate(
    () => (window as unknown as { __noReload?: boolean }).__noReload === true,
  );
  expect(stillNoReload).toBe(true);
});
