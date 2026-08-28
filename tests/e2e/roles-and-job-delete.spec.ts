import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import type { Database } from "@/lib/supabase/database.types";
import { loginAs } from "./helpers/mailpit-login";

// Proves the superadmin/manager/engineer role model end to end through the
// real UI: a superadmin can create a manager, a manager can create an
// engineer but is blocked (both in the UI and, underneath, by RLS) from
// touching manager/superadmin accounts, and deleting a job actually removes
// it and everything that cascades from it.

function adminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

test("superadmin and manager have different user-management reach, per the users_write RLS policy", async ({ page }) => {
  test.setTimeout(60_000);
  const tag = `E2E-ROLES-${Date.now()}`;

  await loginAs(page, "admin@opoc.test");
  await page.goto("/office/users");
  await page.waitForSelector("table");

  // Superadmin: unrestricted role picker, can create a manager.
  const superadminRoles = await page
    .locator("section", { hasText: "Add a user" })
    .locator("select option")
    .allTextContents();
  expect(superadminRoles.sort()).toEqual(["Engineer", "Manager", "Superadmin"]);

  const managerEmail = `${tag.toLowerCase()}-manager@gmail.com`;
  const createForm = page.locator("section", { hasText: "Add a user" });
  await createForm.locator("input").nth(0).fill(`${tag} New Manager`);
  await createForm.locator("input").nth(1).fill(managerEmail);
  await createForm.locator("select").selectOption("manager");
  await page.getByRole("button", { name: "Add user" }).click();
  await expect(page.getByText(`${tag} New Manager added.`)).toBeVisible({ timeout: 10_000 });

  // --- Manager: role picker offers only "engineer", and cannot manage the new manager or superadmin rows. ---
  const managerPage = await page.context().newPage();
  await loginAs(managerPage, "manager@opoc.test");
  await managerPage.goto("/office/users");
  await managerPage.waitForSelector("table");

  const managerRoles = await managerPage
    .locator("section", { hasText: "Add a user" })
    .locator("select option")
    .allTextContents();
  expect(managerRoles).toEqual(["Engineer"]);

  const superadminRow = managerPage.locator("tr", { hasText: "admin@opoc.test" });
  await expect(superadminRow.getByRole("button", { name: /Deactivate|Reactivate/ })).toHaveCount(0);
  const newManagerRow = managerPage.locator("tr", { hasText: managerEmail });
  await expect(newManagerRow.getByRole("button", { name: /Deactivate|Reactivate/ })).toHaveCount(0);

  const engineerEmail = `${tag.toLowerCase()}-engineer@gmail.com`;
  const managerCreateForm = managerPage.locator("section", { hasText: "Add a user" });
  await managerCreateForm.locator("input").nth(0).fill(`${tag} New Engineer`);
  await managerCreateForm.locator("input").nth(1).fill(engineerEmail);
  await managerPage.getByRole("button", { name: "Add user" }).click();
  await expect(managerPage.getByText(`${tag} New Engineer added.`)).toBeVisible({ timeout: 10_000 });

  // The manager CAN deactivate the engineer they just created.
  const newEngineerRow = managerPage.locator("tr", { hasText: engineerEmail });
  await newEngineerRow.getByRole("button", { name: "Deactivate" }).click();
  await expect(newEngineerRow.getByRole("button", { name: "Reactivate" })).toBeVisible({ timeout: 10_000 });

  await managerPage.close();

  // Confirm the new manager account is genuinely untouched — the UI hid
  // the controls, but this proves nothing was silently written underneath.
  // tests/rls.test.ts separately proves the users_write policy itself
  // (including the exact 42501 error a `with check` failure raises).
  const admin = adminClient();
  const { data: newManagerRowDb } = await admin.from("users").select("role, active").eq("email", managerEmail).single();
  expect(newManagerRowDb).toMatchObject({ role: "manager", active: true });
});

test("deleting a job removes it and its dependent rows for good", async ({ page }) => {
  test.setTimeout(60_000);
  const admin = adminClient();
  const tag = `E2E-DEL-${Date.now()}`;

  const { data: site } = await admin.from("sites").select("id").limit(1).single();
  const { data: project } = await admin.from("projects").select("id").limit(1).single();
  const { data: job } = await admin
    .from("jobs")
    .insert({ job_number: tag, project_id: project!.id, site_id: site!.id, job_type: "install", status: "draft" })
    .select("id")
    .single();
  const jobId = job!.id;
  await admin.from("issues").insert({ job_id: jobId, site_id: site!.id, severity: "low", description: "cascade check" });

  await loginAs(page, "admin@opoc.test");
  await page.goto(`/office/jobs/${jobId}`);
  await expect(page.getByText(tag)).toBeVisible();

  await page.getByRole("button", { name: "Delete job" }).click();
  const confirmInput = page.getByPlaceholder(tag);
  await confirmInput.fill("wrong job number");
  await expect(page.getByRole("button", { name: "Permanently delete" })).toBeDisabled();

  await confirmInput.fill(tag);
  await page.getByRole("button", { name: "Permanently delete" }).click();
  await page.waitForURL(/\/office\/jobs$/, { timeout: 10_000 });

  const { data: jobAfter } = await admin.from("jobs").select("id").eq("id", jobId).maybeSingle();
  expect(jobAfter).toBeNull();
  const { data: issueAfter } = await admin.from("issues").select("id").eq("job_id", jobId).maybeSingle();
  expect(issueAfter).toBeNull();
});
