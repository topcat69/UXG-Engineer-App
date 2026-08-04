"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { removeCalendarForJob } from "@/lib/google/sync-job-calendar";
import { createShareLinkForJob } from "@/lib/share-links/create";
import { appBaseUrl } from "@/lib/app-url";
import type { ActionResult } from "../actions";

export async function raiseIssue(jobId: string, siteId: string, formData: FormData): Promise<ActionResult> {
  const severity = String(formData.get("severity") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  if (!severity || !description) return { ok: false, message: "Severity and description are required." };

  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Not signed in." };

  const supabase = await createClient();
  const { error } = await supabase.from("issues").insert({
    job_id: jobId,
    site_id: siteId,
    raised_by: user.id,
    severity,
    description,
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/office/jobs/${jobId}`);
  return { ok: true, message: "Issue raised." };
}

/** Cancels a job and — per spec — deletes its calendar event and nulls calendar_event_id. */
export async function cancelJob(jobId: string, reason: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Not signed in." };

  const supabase = await createClient();
  const { data: job } = await supabase.from("jobs").select("status").eq("id", jobId).single();
  if (!job) return { ok: false, message: "Job not found." };

  const { error } = await supabase.from("jobs").update({ status: "cancelled" }).eq("id", jobId);
  if (error) return { ok: false, message: error.message };

  await supabase.from("status_events").insert({
    job_id: jobId,
    from_status: job.status,
    to_status: "cancelled",
    user_id: user.id,
    reason: reason.trim() || undefined,
  });

  await removeCalendarForJob(supabase, jobId);

  revalidatePath(`/office/jobs/${jobId}`);
  revalidatePath("/office/jobs");
  revalidatePath("/office/scheduler");
  return { ok: true, message: "Job cancelled." };
}

export type CreateShareLinkResult = { ok: true; url: string; expiresAt: string } | { ok: false; message: string };

export async function createShareLink(jobId: string, expiresInDays: number): Promise<CreateShareLinkResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Not signed in." };

  const supabase = await createClient();
  const result = await createShareLinkForJob(supabase, jobId, user.id, expiresInDays);
  if ("error" in result) return { ok: false, message: result.error };

  revalidatePath(`/office/jobs/${jobId}`);
  return { ok: true, url: `${appBaseUrl()}/share/${result.token}`, expiresAt: result.expiresAt };
}

/** Revokes rather than deletes, so the row (and its audit trail — who created it, when) survives. */
export async function revokeShareLink(token: string, jobId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("share_links").update({ revoked: true }).eq("token", token);
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/office/jobs/${jobId}`);
  return { ok: true, message: "Link revoked." };
}
