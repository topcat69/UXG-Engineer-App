import type { Database } from "@/lib/supabase/database.types";

type JobDetailsRow = Database["public"]["Tables"]["job_details"]["Row"];
type JobDetailsInsert = Database["public"]["Tables"]["job_details"]["Insert"];

/**
 * Picks the office-prep/reference and installation fields worth carrying
 * onto a revisit — same site, almost certainly the same hardware, so the
 * engineer shouldn't have to re-upload RAMS or re-scan serials that
 * haven't changed. Deliberately excludes every field that's an *answer*
 * from the original visit (boot test result, issues found, equipment
 * damage, engineer notes, parking/site-manager-reported booleans, ...) —
 * those are outcomes of that specific attempt, not site facts, and
 * copying them onto a job that hasn't actually been re-tested yet would
 * make it look already verified.
 */
export function cloneJobDetailsForRevisit(source: JobDetailsRow): Omit<JobDetailsInsert, "job_id"> {
  return {
    rams_storage_path: source.rams_storage_path,
    site_plan_storage_path: source.site_plan_storage_path,
    design_pack_storage_path: source.design_pack_storage_path,
    parking_permit_storage_path: source.parking_permit_storage_path,
    job_information: source.job_information,
    sla_requirement_detail: source.sla_requirement_detail,
    parking_notes: source.parking_notes,
    site_manager_name: source.site_manager_name,
    site_manager_phone: source.site_manager_phone,
    player_serial: source.player_serial,
    screen_serial: source.screen_serial,
    mount_type: source.mount_type,
    power_source: source.power_source,
    network_type: source.network_type,
    wifi_signal: source.wifi_signal,
    network_port: source.network_port,
  };
}

type JobEquipmentSource = { model: string; serial: string | null; position: number };
type JobEquipmentInsert = Database["public"]["Tables"]["job_equipment"]["Insert"];

/** Same re-index-from-0 pattern as cloneTasksForJob, for the equipment list. */
export function cloneEquipmentForJob(source: JobEquipmentSource[], jobId: string): JobEquipmentInsert[] {
  return source
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((item, i) => ({ job_id: jobId, position: i, model: item.model, serial: item.serial }));
}
