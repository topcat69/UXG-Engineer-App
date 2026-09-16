"use server";

import { revalidatePath } from "next/cache";
import { requireSuperadminUser } from "@/lib/auth/current-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { runHealthCheckSweep } from "@/lib/health/run-health-check";

export type RunHealthCheckNowResult = { ok: true } | { ok: false; message: string };

/**
 * The "Check now" button — runs the exact same sweep as the 15-minute
 * crontab (runHealthCheckSweep), just triggered by a signed-in
 * superadmin instead of the webhook secret. There's no external caller
 * here, so the gate is requireSuperadminUser rather than
 * verifyWebhookSecret.
 */
export async function runHealthCheckNow(): Promise<RunHealthCheckNowResult> {
  await requireSuperadminUser();

  try {
    await runHealthCheckSweep(createAdminClient());
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }

  revalidatePath("/office/health");
  return { ok: true };
}
