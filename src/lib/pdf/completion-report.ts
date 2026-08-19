import "server-only";
import { createHash } from "node:crypto";
import PDFDocument from "pdfkit";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { JOB_TYPE_LABELS } from "@/lib/forms/job-form";
import { humanize } from "@/lib/format/text";
import { formatGpsTimestampOverlay } from "./overlay-text";

type AnySupabaseClient = SupabaseClient<Database>;

type ManifestEntry = { label: string; sha256: string };

/**
 * Every hash in the manifest is computed here, from the bytes just
 * downloaded for embedding — never trusted from `media_assets.sha256`
 * (client-computed at capture time, Phase 3). That makes the manifest a
 * claim about *this PDF's own contents* ("these are the exact bytes
 * embedded on the page above"), not a pass-through of an unverified
 * upstream value — the stronger property for something meant to "stand up
 * as evidence" per spec.
 */
function sha256Hex(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

/**
 * Formats one form-answer field for the "Form answers" section, or null to
 * skip it entirely (unanswered). Booleans render as Yes/No — this used to
 * print pdfkit's default `${value}` interpolation of `true`/`false`
 * literally, most visibly on "Revisit required". Pass/fail fields are
 * stored lowercase ("pass"/"fail"/"na") and need humanizing; every other
 * string field (serials, notes, the Select-driven fields) is already in
 * its intended display casing.
 */
function formatFieldValue(label: string, value: string | boolean | null): string | null {
  if (value === null || value === "") return null;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (label === "Player boot test" || label === "Content displaying") return humanize(value);
  return value;
}

/** Exported for job-archive.ts, which needs the same original bytes this file already downloads for embedding. */
export async function downloadBytes(supabase: AnySupabaseClient, storagePath: string): Promise<Buffer | null> {
  const { data } = await supabase.storage.from("media").download(storagePath);
  if (!data) return null;
  return Buffer.from(await data.arrayBuffer());
}

/**
 * Generates the full completion PDF for one job and returns it as a
 * Buffer — job details, form answers, photos with GPS/timestamp overlays,
 * signatures, and a hash manifest. Caller is responsible for uploading it
 * and setting `jobs.completion_pdf_url` (see qa/actions.ts's approveJob).
 */
export async function generateCompletionReport(supabase: AnySupabaseClient, jobId: string): Promise<Buffer> {
  const [{ data: job }, { data: installForm }, { data: jobDetails }, { data: media }, { data: signatures }, { data: issues }] =
    await Promise.all([
      supabase
        .from("jobs")
        .select("job_number, job_type, status, scheduled_start, actual_travel_start, actual_start, actual_end, site:sites(name, address_line1, address_line2, town, postcode), project:projects(name)")
        .eq("id", jobId)
        .single(),
      supabase.from("install_forms").select("*").eq("job_id", jobId).maybeSingle(),
      supabase.from("job_details").select("*").eq("job_id", jobId).maybeSingle(),
      supabase.from("media_assets").select("*").eq("job_id", jobId).order("slot"),
      supabase.from("signatures").select("*").eq("job_id", jobId),
      supabase.from("issues").select("severity, description, status").eq("job_id", jobId).order("created_at"),
    ]);
  if (!job) throw new Error(`Job ${jobId} not found`);

  const doc = new PDFDocument({ margin: 50 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  const manifest: ManifestEntry[] = [];

  // --- Cover: job details ---
  doc.fontSize(20).text("UXG Engineer Job Scheduler — Completion Report", { align: "center" });
  doc.moveDown();
  doc.fontSize(14).text(job.job_number);
  doc.fontSize(10).fillColor("#555");
  doc.text(`Site: ${job.site?.name ?? "—"}`);
  doc.text(
    `Address: ${[job.site?.address_line1, job.site?.address_line2, job.site?.town, job.site?.postcode].filter(Boolean).join(", ")}`,
  );
  doc.text(`Project: ${job.project?.name ?? "—"}`);
  doc.text(`Job type: ${JOB_TYPE_LABELS[job.job_type as keyof typeof JOB_TYPE_LABELS] ?? humanize(job.job_type)}`);
  doc.text(`Status: ${humanize(job.status)}`);
  if (job.actual_travel_start) doc.text(`Travel started: ${new Date(job.actual_travel_start).toLocaleString("en-GB")}`);
  if (job.actual_start) doc.text(`Started: ${new Date(job.actual_start).toLocaleString("en-GB")}`);
  if (job.actual_end) doc.text(`Completed: ${new Date(job.actual_end).toLocaleString("en-GB")}`);
  doc.fillColor("black");

  // --- Form answers ---
  if (installForm) {
    doc.moveDown().fontSize(14).text("Form answers");
    doc.fontSize(10);
    const fields: [string, string | boolean | null][] = [
      ["Player serial", installForm.player_serial],
      ["Screen serial", installForm.screen_serial],
      ["Mount type", installForm.mount_type],
      ["Power source", installForm.power_source],
      ["Network type", installForm.network_type],
      ["WiFi signal", installForm.wifi_signal],
      ["Player boot test", installForm.player_boot_test],
      ["Content displaying", installForm.content_displaying],
      ["Issues found", installForm.issues_found],
      ["Issue detail", installForm.issue_detail],
      ["Client name", installForm.client_name],
      ["Engineer notes", installForm.engineer_notes],
    ];
    for (const [label, value] of fields) {
      const formatted = formatFieldValue(label, value);
      if (formatted !== null) doc.text(`${label}: ${formatted}`);
    }
  }

  if (jobDetails) {
    doc.moveDown().fontSize(14).text("Form answers");
    doc.fontSize(10);
    const fields: [string, string | boolean | null][] = [
      ["Player serial", jobDetails.player_serial],
      ["Screen serial", jobDetails.screen_serial],
      ["Mount type", jobDetails.mount_type],
      ["Power source", jobDetails.power_source],
      ["Network type", jobDetails.network_type],
      ["WiFi signal", jobDetails.wifi_signal],
      ["Player boot test", jobDetails.player_boot_test],
      ["Content displaying", jobDetails.content_displaying],
      ["SLA requirement", jobDetails.sla_requirement_detail],
      ["Parking notified", jobDetails.parking_notified],
      ["Reported to site manager", jobDetails.reported_to_site_manager],
      ["Revisit required", jobDetails.revisit_required],
      ["Issues found", jobDetails.issues_found],
      ["Issue detail", jobDetails.issue_detail],
      ["Engineer notes", jobDetails.engineer_notes],
    ];
    for (const [label, value] of fields) {
      const formatted = formatFieldValue(label, value);
      if (formatted !== null) doc.text(`${label}: ${formatted}`);
    }
  }

  // --- Issues raised ---
  if (issues && issues.length > 0) {
    doc.moveDown().fontSize(14).text("Issues raised");
    doc.fontSize(10);
    for (const issue of issues) {
      doc.text(`[${humanize(issue.severity)}, ${humanize(issue.status ?? "")}] ${issue.description}`);
    }
  }

  // --- Photos and videos, one per page, GPS/timestamp overlay burned in ---
  // pdfkit's .image() only understands JPEG/PNG, so a video can't be
  // embedded the way a photo is — it still gets a page (label, overlay,
  // and a manifest entry hashing the actual downloaded bytes, same
  // evidentiary record as a photo), just as a note instead of an image.
  for (const photo of media ?? []) {
    const bytes = await downloadBytes(supabase, photo.storage_path);
    if (!bytes) continue;
    const isVideo = photo.media_type === "video";
    manifest.push({ label: `${isVideo ? "Video" : "Photo"}: ${photo.slot}`, sha256: sha256Hex(bytes) });

    doc.addPage();
    doc.fontSize(12).text(humanize(photo.slot.replace("photo_", "")));
    if (isVideo) {
      doc.fontSize(10).text("Video captured on site — see the job record for playback.");
    } else {
      doc.image(bytes, { fit: [500, 600], align: "center" });
    }
    const overlay = formatGpsTimestampOverlay(photo.latitude, photo.longitude, photo.captured_at);
    doc.fontSize(9).fillColor("#333").text(overlay, { align: "center" });
    doc.fillColor("black");
  }

  // --- Signatures ---
  for (const signature of signatures ?? []) {
    const bytes = await downloadBytes(supabase, signature.storage_path);
    if (!bytes) continue;
    manifest.push({ label: `Signature: ${signature.signer_name}`, sha256: sha256Hex(bytes) });

    doc.addPage();
    doc.fontSize(12).text(`Signed by ${signature.signer_name} (${signature.signer_role})`);
    doc.image(bytes, { fit: [400, 200] });
    const overlay = formatGpsTimestampOverlay(signature.latitude, signature.longitude, signature.signed_at);
    doc.fontSize(9).fillColor("#333").text(overlay);
    doc.fillColor("black");
  }

  // --- Hash manifest: proves what's actually embedded above ---
  doc.addPage();
  doc.fontSize(14).text("Hash manifest (SHA-256)");
  doc.fontSize(8).font("Courier");
  for (const entry of manifest) {
    doc.text(`${entry.sha256}  ${entry.label}`);
  }

  doc.end();
  return done;
}

export type StoreReportResult = { path: string } | { error: string };

/**
 * Generates the report and uploads it under the same `jobs/{job_id}/...`
 * path convention media already uses — reuses the existing storage.objects
 * RLS policies (`(storage.foldername(name))[2]::uuid in (select id from
 * jobs)`) for free rather than needing a new bucket or new policies.
 * `jobs.completion_pdf_url` stores this path, not a signed URL — the
 * private bucket means callers (the approved email, the share page) sign
 * it fresh at read time, same pattern as photos.
 */
export async function generateAndStoreCompletionReport(supabase: AnySupabaseClient, jobId: string): Promise<StoreReportResult> {
  try {
    const pdf = await generateCompletionReport(supabase, jobId);
    const path = `jobs/${jobId}/completion-report.pdf`;
    const { error } = await supabase.storage.from("media").upload(path, pdf, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (error) return { error: error.message };
    return { path };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}
