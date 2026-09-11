"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { nextJobNumber } from "@/lib/jobs/job-number";
import { maxJobSequenceForYear } from "@/lib/jobs/next-job-number";
import { assignJobSheetToJob } from "../job-sheets/[id]/actions";

export type CreateSlaJobResult = { ok: true; jobId: string } | { ok: false; message: string };

/**
 * The dedicated SLA creation flow: Customer -> Site -> Fixture Type, no
 * Project (see 20260907000000_client_sla_lists.sql's own comment — an SLA
 * is one per customer, not tied to an install rollout). Still just a
 * `jobs` row (job_type "sla", project_id null) reusing the exact same
 * job-number scheme and full lifecycle as createJob (office/jobs/actions.ts)
 * — the only real difference is that fixture_type_id is set on job_details
 * right away, since (unlike every other job type) the office already knows
 * what broke before the job exists at all.
 *
 * jobSheetId is optional, same as createJob's — an SLA callout sometimes
 * already has a replacement unit prepared on a Job Sheet, so it can be
 * linked right here instead of a separate trip to assign it afterward.
 */
export async function createSlaJob(
  clientId: string,
  siteId: string,
  fixtureTypeId: string,
  jobSheetId?: string,
): Promise<CreateSlaJobResult> {
  if (!clientId) return { ok: false, message: "Select a customer." };
  if (!siteId) return { ok: false, message: "Select a site." };
  if (!fixtureTypeId) return { ok: false, message: "Select a fixture type." };

  const supabase = await createClient();

  // The form derives its site/fixture-type lists from the chosen customer,
  // so this can't happen from the UI — but nothing at the DB level ties
  // either one to a customer, so it's still worth guarding server-side
  // (same reasoning as createJob's project/site client_id check).
  const [{ data: site }, { data: fixtureType }] = await Promise.all([
    supabase.from("sites").select("client_id").eq("id", siteId).single(),
    supabase.from("client_sla_fixture_types").select("client_id").eq("id", fixtureTypeId).single(),
  ]);
  if (site?.client_id !== clientId) return { ok: false, message: "That site doesn't belong to this customer." };
  if (fixtureType?.client_id !== clientId) return { ok: false, message: "That fixture type doesn't belong to this customer." };

  if (jobSheetId) {
    const { data: jobSheet } = await supabase.from("job_sheets").select("site_id").eq("id", jobSheetId).single();
    if (jobSheet?.site_id !== siteId) return { ok: false, message: "That job sheet belongs to a different site." };
  }

  const year = new Date().getFullYear();
  const maxSeq = await maxJobSequenceForYear(supabase, year);

  const { data: job, error } = await supabase
    .from("jobs")
    .insert({
      job_number: nextJobNumber(maxSeq, year, 1),
      project_id: null,
      site_id: siteId,
      job_type: "sla",
      status: "draft",
    })
    .select("id")
    .single();
  if (error) return { ok: false, message: error.message };

  const { error: detailsError } = await supabase
    .from("job_details")
    .upsert({ job_id: job.id, fixture_type_id: fixtureTypeId }, { onConflict: "job_id" });
  if (detailsError) return { ok: false, message: detailsError.message };

  if (jobSheetId) {
    const linkResult = await assignJobSheetToJob(jobSheetId, job.id);
    if (!linkResult.ok) return { ok: false, message: `SLA created, but failed to link the job sheet: ${linkResult.message}` };
  }

  revalidatePath("/office/sla");
  return { ok: true, jobId: job.id };
}
