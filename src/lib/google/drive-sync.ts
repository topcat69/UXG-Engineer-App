import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { createOrFetchFolder, customerJobsRootFolderId } from "./drive-folders";

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
  }
}

/**
 * Creates (or fetches) the project's Drive folder inside its client's
 * folder — ensuring the client's folder first, since a project can be
 * created before its client has ever needed one. Same best-effort
 * contract as ensureClientDriveFolder.
 */
export async function ensureProjectDriveFolder(supabase: AnySupabaseClient, projectId: string): Promise<void> {
  try {
    if (!customerJobsRootFolderId()) return;

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("name, client_id, drive_folder_id")
      .eq("id", projectId)
      .single();
    if (projectError) throw projectError;
    if (!project || project.drive_folder_id || !project.client_id) return;

    await ensureClientDriveFolder(supabase, project.client_id);
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("drive_folder_id")
      .eq("id", project.client_id)
      .single();
    if (clientError) throw clientError;
    if (!client?.drive_folder_id) return;

    const folderId = await createOrFetchFolder(project.name, client.drive_folder_id);
    if (!folderId) return;
    const { error: updateError } = await supabase.from("projects").update({ drive_folder_id: folderId }).eq("id", projectId);
    if (updateError) throw updateError;
  } catch (error) {
    console.error(`Drive project folder sync failed for project ${projectId}`, error);
  }
}

/**
 * Creates (or fetches) the job's own Drive folder, nested under a Site
 * folder, nested under the job's Project folder — or, for job_type "sla"
 * (always created with project_id null, see office/sla/actions.ts's own
 * comment), directly under the Client folder, skipping the Project level
 * entirely, since there's no project to nest it under.
 *
 * Unlike the client/project folders, the Site-level folder here is never
 * cached: the same site can legitimately sit under more than one Project
 * folder (or under Client directly for an SLA job) depending on which job
 * put it there — see this migration's own comment — so it's found-or-created
 * fresh every time, which is idempotent and cheap at job-creation volume.
 * Only the job's own leaf folder, genuinely 1:1 with its row, gets cached.
 * Same best-effort, non-blocking contract as the client/project folders.
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

    const { data: site, error: siteError } = await supabase.from("sites").select("name, client_id").eq("id", job.site_id).single();
    if (siteError) throw siteError;
    if (!site) return;

    let siteParentFolderId: string | null;
    if (job.project_id) {
      await ensureProjectDriveFolder(supabase, job.project_id);
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .select("drive_folder_id")
        .eq("id", job.project_id)
        .single();
      if (projectError) throw projectError;
      siteParentFolderId = project?.drive_folder_id ?? null;
    } else {
      await ensureClientDriveFolder(supabase, site.client_id);
      const { data: client, error: clientError } = await supabase
        .from("clients")
        .select("drive_folder_id")
        .eq("id", site.client_id)
        .single();
      if (clientError) throw clientError;
      siteParentFolderId = client?.drive_folder_id ?? null;
    }
    if (!siteParentFolderId) return;

    const siteFolderId = await createOrFetchFolder(site.name, siteParentFolderId);
    if (!siteFolderId) return;

    const jobFolderId = await createOrFetchFolder(job.job_number, siteFolderId);
    if (!jobFolderId) return;
    const { error: updateError } = await supabase.from("jobs").update({ drive_folder_id: jobFolderId }).eq("id", jobId);
    if (updateError) throw updateError;
  } catch (error) {
    console.error(`Drive job folder sync failed for job ${jobId}`, error);
  }
}
