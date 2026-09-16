import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { createOrFetchFolder, customerJobsRootFolderId } from "./drive-folders";
import { recordIntegrationFailure } from "@/lib/health/integration-failures";

type AnySupabaseClient = SupabaseClient<Database>;

/**
 * Creates (or fetches) the client's Drive folder directly under Customer
 * Jobs New and persists its id — best-effort, same contract as
 * syncCalendarForJob: a Drive failure (including "not configured" in this
 * sandbox) never throws back into the caller, since creating a client
 * must succeed regardless of whether Drive is reachable. Grow-as-you-go
 * per the confirmed scoping — this only ever runs when a client is
 * created, never as a backfill over existing rows.
 *
 * supabase-js never throws on a query error (it returns `{ data: null,
 * error }`), so every query below checks `error` explicitly and throws it
 * — otherwise a real failure (e.g. a genuinely missing column, as
 * happened in production once already) reads identically to "no row
 * found" and the outer catch's console.error, the only thing that would
 * otherwise surface it, never fires.
 */
export async function ensureClientDriveFolder(supabase: AnySupabaseClient, clientId: string): Promise<void> {
  try {
    const root = customerJobsRootFolderId();
    if (!root) return;

    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("name, drive_folder_id")
      .eq("id", clientId)
      .single();
    if (clientError) throw clientError;
    if (!client || client.drive_folder_id) return;

    const folderId = await createOrFetchFolder(client.name, root);
    if (!folderId) return;
    const { error: updateError } = await supabase.from("clients").update({ drive_folder_id: folderId }).eq("id", clientId);
    if (updateError) throw updateError;
  } catch (error) {
    console.error(`Drive client folder sync failed for client ${clientId}`, error);
    await recordIntegrationFailure("drive", error instanceof Error ? error.message : String(error));
  }
}

/**
 * Creates (or fetches) the site's Drive folder inside its client's
 * folder — ensuring the client's folder first, since a site can be
 * created before its client has ever needed one. Site always has
 * exactly one parent (its client), so its folder id is genuinely 1:1
 * with its row and safe to cache, same as the client/job folders. Same
 * best-effort contract as ensureClientDriveFolder.
 */
export async function ensureSiteDriveFolder(supabase: AnySupabaseClient, siteId: string): Promise<void> {
  try {
    if (!customerJobsRootFolderId()) return;

    const { data: site, error: siteError } = await supabase
      .from("sites")
      .select("name, client_id, drive_folder_id")
      .eq("id", siteId)
      .single();
    if (siteError) throw siteError;
    if (!site || site.drive_folder_id) return;

    await ensureClientDriveFolder(supabase, site.client_id);
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("drive_folder_id")
      .eq("id", site.client_id)
      .single();
    if (clientError) throw clientError;
    if (!client?.drive_folder_id) return;

    const folderId = await createOrFetchFolder(site.name, client.drive_folder_id);
    if (!folderId) return;
    const { error: updateError } = await supabase.from("sites").update({ drive_folder_id: folderId }).eq("id", siteId);
    if (updateError) throw updateError;
  } catch (error) {
    console.error(`Drive site folder sync failed for site ${siteId}`, error);
    await recordIntegrationFailure("drive", error instanceof Error ? error.message : String(error));
  }
}

/**
 * Creates (or fetches) the job's own Drive folder, nested directly under
 * its Site's folder — Project is deliberately not a folder level (see
 * the 2026-09-16 restructure migration's own comment: a project can span
 * several sites for the same client, which would mean duplicating its
 * folder under every one of them). Where the job has a project, its name
 * is folded into the job folder's own name instead — e.g. "UXG-2026-0061
 * — Signage Rollout Phase 1" — so it's still visible without being its
 * own nesting level. Same best-effort, non-blocking contract as the
 * client/site folders.
 */
export async function ensureJobDriveFolder(supabase: AnySupabaseClient, jobId: string): Promise<void> {
  try {
    if (!customerJobsRootFolderId()) return;

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("job_number, project_id, site_id, drive_folder_id")
      .eq("id", jobId)
      .single();
    if (jobError) throw jobError;
    if (!job || job.drive_folder_id) return;

    await ensureSiteDriveFolder(supabase, job.site_id);
    const { data: site, error: siteError } = await supabase.from("sites").select("drive_folder_id").eq("id", job.site_id).single();
    if (siteError) throw siteError;
    if (!site?.drive_folder_id) return;

    let jobFolderName = job.job_number;
    if (job.project_id) {
      const { data: project, error: projectError } = await supabase.from("projects").select("name").eq("id", job.project_id).single();
      if (projectError) throw projectError;
      if (project?.name) jobFolderName = `${job.job_number} — ${project.name}`;
    }

    const jobFolderId = await createOrFetchFolder(jobFolderName, site.drive_folder_id);
    if (!jobFolderId) return;
    const { error: updateError } = await supabase.from("jobs").update({ drive_folder_id: jobFolderId }).eq("id", jobId);
    if (updateError) throw updateError;
  } catch (error) {
    console.error(`Drive job folder sync failed for job ${jobId}`, error);
    await recordIntegrationFailure("drive", error instanceof Error ? error.message : String(error));
  }
}
