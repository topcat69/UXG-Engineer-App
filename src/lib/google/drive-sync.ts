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
 */
export async function ensureClientDriveFolder(supabase: AnySupabaseClient, clientId: string): Promise<void> {
  try {
    const root = customerJobsRootFolderId();
    if (!root) return;

    const { data: client } = await supabase.from("clients").select("name, drive_folder_id").eq("id", clientId).single();
    if (!client || client.drive_folder_id) return;

    const folderId = await createOrFetchFolder(client.name, root);
    if (!folderId) return;
    await supabase.from("clients").update({ drive_folder_id: folderId }).eq("id", clientId);
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

    const { data: project } = await supabase.from("projects").select("name, client_id, drive_folder_id").eq("id", projectId).single();
    if (!project || project.drive_folder_id || !project.client_id) return;

    await ensureClientDriveFolder(supabase, project.client_id);
    const { data: client } = await supabase.from("clients").select("drive_folder_id").eq("id", project.client_id).single();
    if (!client?.drive_folder_id) return;

    const folderId = await createOrFetchFolder(project.name, client.drive_folder_id);
    if (!folderId) return;
    await supabase.from("projects").update({ drive_folder_id: folderId }).eq("id", projectId);
  } catch (error) {
    console.error(`Drive project folder sync failed for project ${projectId}`, error);
  }
}
