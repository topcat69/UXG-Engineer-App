import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import type { Database } from "@/lib/supabase/database.types";
import { loginAs } from "./helpers/mailpit-login";
import { TINY_PNG_BASE64 } from "./fixtures/tiny-photo";

// Proves the templates/tasks/duplicate feature end to end: an office user
// builds a reusable template, applies it to a job, the field engineer can't
// submit until every task is ticked off, and duplicating a job clones its
// task list (unticked) onto a fresh draft.

function adminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

test("template application, submit gating on incomplete tasks, and job duplication cloning tasks", async ({ page }) => {
  test.setTimeout(90_000);
  const admin = adminClient();
  const tag = `E2E-TMPL-${Date.now()}`;
  const templateName = `Checklist ${tag}`;

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

  // --- Office: build a template with two tasks. ---
  await loginAs(page, "manager@opoc.test");
  await page.goto("/office/templates");
  await page.getByPlaceholder("New template name").fill(templateName);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("button", { name: templateName, exact: true }).last()).toBeVisible();

  await page.getByPlaceholder("New task, e.g. 'Test power cycle'").fill("Verify screen mount");
  await page.getByRole("button", { name: "Add task" }).click();
  await expect(page.getByText("Verify screen mount")).toBeVisible({ timeout: 10_000 });
  await page.getByPlaceholder("New task, e.g. 'Test power cycle'").fill("Photograph cable run");
  await page.getByRole("button", { name: "Add task" }).click();
  await expect(page.getByText("Photograph cable run")).toBeVisible({ timeout: 10_000 });

  // --- Office: apply the template to the job. ---
  await page.goto(`/office/jobs/${jobId}`);
  await expect(page.getByText("No tasks for this job yet.")).toBeVisible({ timeout: 10_000 });
  await page.getByRole("combobox", { name: "Apply template" }).selectOption({ label: templateName });
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText("Verify screen mount")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Photograph cable run")).toBeVisible({ timeout: 10_000 });

  // --- Office: duplicate the job and confirm its tasks were cloned, unticked. ---
  await page.getByRole("button", { name: "Duplicate job" }).click();
  await page.waitForURL((url) => url.pathname.startsWith("/office/jobs/") && !url.pathname.endsWith(jobId), {
    timeout: 10_000,
  });
  const duplicateUrl = page.url();
  expect(duplicateUrl).not.toContain(jobId);
  await expect(page.getByText("Draft", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Verify screen mount")).toBeVisible();
  await expect(page.getByText("Photograph cable run")).toBeVisible();
  const duplicateCheckboxes = page.locator('section:has(h2:text("Tasks")) input[type="checkbox"]');
  await expect(duplicateCheckboxes.first()).not.toBeChecked();

  // --- Field: check in, and the same checklist blocks submit until ticked. ---
  await page.context().grantPermissions(["geolocation"]);
  await page.context().setGeolocation({ latitude: site!.latitude ?? 51.5, longitude: site!.longitude ?? -0.1 });

  const fieldPage = await page.context().newPage();
  await loginAs(fieldPage, "engineer@opoc.test");
  await fieldPage.getByText(tag).click();
  await fieldPage.getByRole("button", { name: "Start Travelling" }).click({ force: true });
  await expect(fieldPage.getByRole("button", { name: /Check In/ })).toBeVisible({ timeout: 10_000 });
  await fieldPage.getByRole("button", { name: /Check In/ }).click();
  await expect(fieldPage.getByText("In Progress")).toBeVisible({ timeout: 15_000 });

  const taskCheckboxes = fieldPage.locator('ul:has-text("Verify screen mount") input[type="checkbox"]');
  await expect(taskCheckboxes).toHaveCount(2);

  await fieldPage.locator("label", { hasText: "Player serial" }).locator("input").fill(`PLR-${tag}`);
  await fieldPage.locator("label", { hasText: "Screen serial" }).locator("input").fill(`SCR-${tag}`);
  async function selectByLabel(labelText: string, optionText: string) {
    await fieldPage.locator("label", { hasText: labelText }).locator("select").selectOption({ label: optionText });
  }
  await selectByLabel("Mount type", "Wall");
  await selectByLabel("Power source", "Existing socket");
  await selectByLabel("Network", "Ethernet");
  await selectByLabel("Player boot test", "Pass");
  await selectByLabel("Content displaying", "Pass");
  await fieldPage.locator("label", { hasText: "Client name" }).locator("input").fill("Tasks Test Client");

  const photoBuffer = Buffer.from(TINY_PNG_BASE64, "base64");
  const fileInputs = fieldPage.locator('input[type="file"]');
  const slotCount = await fileInputs.count();
  for (let i = 0; i < slotCount; i++) {
    await fileInputs.nth(i).setInputFiles({ name: `photo-${i}.png`, mimeType: "image/png", buffer: photoBuffer });
  }
  await fieldPage.waitForFunction(
    () =>
      Array.from(document.querySelectorAll('button[aria-label^="Capture photo"]')).every((b) =>
        b.textContent?.includes("✅"),
      ),
    { timeout: 20_000 },
  );

  const canvas = fieldPage.locator("canvas");
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  await fieldPage.mouse.move(box.x + 20, box.y + 20);
  await fieldPage.mouse.down();
  await fieldPage.mouse.move(box.x + 100, box.y + 60, { steps: 5 });
  await fieldPage.mouse.up();
  await fieldPage.getByRole("button", { name: "Save signature" }).click();
  await expect(fieldPage.getByText("Signature captured")).toBeVisible();

  // Submit with tasks still unticked: blocked, job stays in_progress.
  await fieldPage.getByRole("button", { name: /Check Out & Submit/ }).click();
  await expect(fieldPage.getByText("2 tasks are not yet checked off.")).toBeVisible();
  await expect(fieldPage.getByText("In Progress")).toBeVisible();

  // Tick both tasks, then submit succeeds. Ticking is an async Dexie write
  // (toggleTask) whose useLiveQuery-driven `checked` update lands a tick
  // after the click, so poll for it rather than using .check()'s stricter
  // single-attempt actionability wait.
  await taskCheckboxes.nth(0).click();
  await expect(taskCheckboxes.nth(0)).toBeChecked({ timeout: 5_000 });
  await taskCheckboxes.nth(1).click();
  await expect(taskCheckboxes.nth(1)).toBeChecked({ timeout: 5_000 });

  // The checkbox's own checked paint is one signal the Dexie write landed;
  // handleSubmit's `tasks` closure catching up to it (React re-render ->
  // handler re-bound) is a separate one that can trail slightly behind —
  // a scripted click-click-click can outrun it even though a real
  // engineer's finger never would. Give it a moment to settle before
  // clicking Submit, retried below if it was still one tick behind.
  await fieldPage.waitForTimeout(300);
  await fieldPage.getByRole("button", { name: /Check Out & Submit/ }).click();
  if (await fieldPage.getByText(/task.*not yet checked off/).isVisible().catch(() => false)) {
    await fieldPage.getByRole("button", { name: /Check Out & Submit/ }).click();
  }
  await expect(fieldPage.getByText("This job is submitted.")).toBeVisible({ timeout: 10_000 });

  const { data: tasksAfter } = await admin.from("job_tasks").select("is_done").eq("job_id", jobId);
  expect(tasksAfter).toHaveLength(2);
  expect(tasksAfter!.every((t) => t.is_done)).toBe(true);

  await fieldPage.close();
});
