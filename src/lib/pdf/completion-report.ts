import "server-only";
import { createHash } from "node:crypto";
import PDFDocument from "pdfkit";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { JOB_TYPE_LABELS } from "@/lib/forms/job-form";
import { humanize } from "@/lib/format/text";
import { formatDurationBetween } from "@/lib/format/duration";
import { formatGpsTimestampOverlay } from "./overlay-text";
import {
  BRAND,
  PAGE_MARGINS,
  drawBanner,
  drawFooters,
  drawSectionBar,
  drawSignatureBox,
  fieldBlock,
  labelledParagraph,
  loadLogoBytes,
  photoBlock,
  severityAccent,
  twoColumnRow,
} from "./brand";

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
 * Formats one form-answer field for the "Form Details" section, or null to
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

function formatDateTime(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString("en-GB") : "—";
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
 *
 * Laid out to match the UXG Brand Manual (2023) and a reference report
 * layout the office provided: a branded banner with the UXG logo on every
 * page (brand.ts's drawBanner, registered against pdfkit's 'pageAdded'
 * event so it also covers pages pdfkit adds itself when content
 * overflows), a cover page of Job Details/Field Agent/Scheduling/
 * Completion sections, then one labelled block per form field/photo/issue
 * — the same "field name as a small heading, its answer beneath" shape the
 * reference layout uses for its own RFI entries, just backed by this app's
 * own job_details/install_forms fields and issues rather than AppSheet's
 * RFI ids. See DECISIONS.md for what was deliberately simplified versus
 * that reference (no Montserrat embedding, no per-field "completed by").
 */
export async function generateCompletionReport(supabase: AnySupabaseClient, jobId: string): Promise<Buffer> {
  const [{ data: job }, { data: installForm }, { data: jobDetails }, { data: media }, { data: signatures }, { data: issues }] =
    await Promise.all([
      supabase
        .from("jobs")
        .select(
          "job_number, job_type, status, description, scheduled_start, actual_travel_start, actual_start, actual_end, site:sites(name, address_line1, address_line2, town, postcode, client:clients(name)), project:projects(name), assigned:users!jobs_assigned_to_fkey(name, email, phone, company)",
        )
        .eq("id", jobId)
        .single(),
      supabase.from("install_forms").select("*").eq("job_id", jobId).maybeSingle(),
      supabase.from("job_details").select("*").eq("job_id", jobId).maybeSingle(),
      supabase.from("media_assets").select("*").eq("job_id", jobId).order("slot"),
      supabase.from("signatures").select("*").eq("job_id", jobId),
      supabase.from("issues").select("severity, description, status").eq("job_id", jobId).order("created_at"),
    ]);
  if (!job) throw new Error(`Job ${jobId} not found`);

  const doc = new PDFDocument({ margins: PAGE_MARGINS, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  const logo = loadLogoBytes();
  doc.on("pageAdded", () => drawBanner(doc, logo, "Job Report"));
  drawBanner(doc, logo, "Job Report"); // 'pageAdded' doesn't fire for the page the constructor itself creates

  const manifest: ManifestEntry[] = [];

  // --- Cover: top summary row ---
  const siteName = job.site?.name ?? "—";
  const clientName = job.site?.client?.name ?? null;
  const reportFor = clientName ? `${clientName} — ${siteName}` : siteName;
  twoColumnRow(doc, ["Job Report For:", reportFor], ["Author:", job.assigned?.name]);
  twoColumnRow(doc, ["No. Issues:", String(issues?.length ?? 0)], ["Date:", new Date().toLocaleDateString("en-GB")]);
  doc.moveDown(0.5);

  // --- Job Details ---
  drawSectionBar(doc, "Job Details");
  twoColumnRow(doc, ["Project Name:", job.project?.name], ["Job Code:", job.job_number]);
  twoColumnRow(doc, ["Location Name:", siteName], ["Job Type:", JOB_TYPE_LABELS[job.job_type as keyof typeof JOB_TYPE_LABELS] ?? humanize(job.job_type)]);
  twoColumnRow(doc, ["Status:", humanize(job.status)]);
  const address = [job.site?.address_line1, job.site?.address_line2, job.site?.town, job.site?.postcode].filter(Boolean).join(", ");
  labelledParagraph(doc, "Address:", address || null);
  labelledParagraph(doc, "Job Description:", job.description);
  doc.moveDown(0.3);

  // --- Field Agent ---
  drawSectionBar(doc, "Field Agent");
  twoColumnRow(doc, ["Allocated To:", job.assigned?.company || "UX Global"], ["FA Mobile:", job.assigned?.phone]);
  twoColumnRow(doc, ["FA Name:", job.assigned?.name], ["FA Email:", job.assigned?.email]);
  doc.moveDown(0.3);

  // --- Scheduling ---
  drawSectionBar(doc, "Scheduling");
  twoColumnRow(doc, ["Scheduled Start:", formatDateTime(job.scheduled_start)], ["Actual End:", formatDateTime(job.actual_end)]);
  twoColumnRow(doc, ["Actual Start:", formatDateTime(job.actual_start)], ["Time on job:", formatDurationBetween(job.actual_start, job.actual_end)]);
  twoColumnRow(doc, ["Travel started:", formatDateTime(job.actual_travel_start)], ["Time travelling:", formatDurationBetween(job.actual_travel_start, job.actual_start)]);
  doc.moveDown(0.3);

  // --- Completion ---
  drawSectionBar(doc, "Completion");
  const signature = signatures?.[0];
  const signatureBytes = signature ? await downloadBytes(supabase, signature.storage_path) : null;
  const completionY = doc.y;
  doc.font("Helvetica-Bold").fontSize(9).fillColor(BRAND.charcoal).text("Signed By:", PAGE_MARGINS.left, completionY, { width: 100, lineBreak: false });
  doc.font("Helvetica").fillColor(BRAND.digitalPink).text(signature?.signer_name ?? "—", PAGE_MARGINS.left + 100, completionY, { lineBreak: false });
  doc.font("Helvetica-Bold").fillColor(BRAND.charcoal).text("Job Title:", PAGE_MARGINS.left, completionY + 16, { width: 100, lineBreak: false });
  doc.font("Helvetica").fillColor(BRAND.digitalPink).text(signature?.signer_role ?? "—", PAGE_MARGINS.left + 100, completionY + 16, { lineBreak: false });
  doc.fillColor("black").font("Helvetica");
  const sigBoxWidth = 220;
  const sigBoxHeight = 90;
  const sigBoxX = doc.page.width - PAGE_MARGINS.right - sigBoxWidth;
  drawSignatureBox(doc, sigBoxX, completionY, sigBoxWidth, sigBoxHeight, signatureBytes);
  doc.y = completionY + Math.max(40, sigBoxHeight) + 10;
  if (signature && signatureBytes) {
    manifest.push({ label: `Signature: ${signature.signer_name}`, sha256: sha256Hex(signatureBytes) });
  }
  // Any additional signatures beyond the first (rare — one client sign-off
  // per job in practice) still get hashed into the manifest even though
  // only the first is shown on the cover.
  for (const extra of (signatures ?? []).slice(1)) {
    const bytes = await downloadBytes(supabase, extra.storage_path);
    if (bytes) manifest.push({ label: `Signature: ${extra.signer_name}`, sha256: sha256Hex(bytes) });
  }

  // --- Form Details ---
  const formFields: [string, string | boolean | null][] = installForm
    ? [
        ["Player serial", installForm.player_serial],
        ["Screen serial", installForm.screen_serial],
        ["Mount type", installForm.mount_type],
        ["Power source", installForm.power_source],
        ["Network type", installForm.network_type],
        ["WiFi signal", installForm.wifi_signal],
        ["Network port", installForm.network_port],
        ["Player boot test", installForm.player_boot_test],
        ["Content displaying", installForm.content_displaying],
        ["Issues found", installForm.issues_found],
        ["Issue detail", installForm.issue_detail],
        ["Client name", installForm.client_name],
        ["Engineer notes", installForm.engineer_notes],
      ]
    : jobDetails
      ? [
          ["Player serial", jobDetails.player_serial],
          ["Screen serial", jobDetails.screen_serial],
          ["Mount type", jobDetails.mount_type],
          ["Power source", jobDetails.power_source],
          ["Network type", jobDetails.network_type],
          ["WiFi signal", jobDetails.wifi_signal],
          ["Network port", jobDetails.network_port],
          ["Player boot test", jobDetails.player_boot_test],
          ["Content displaying", jobDetails.content_displaying],
          ["SLA requirement", jobDetails.sla_requirement_detail],
          ["Parking notified", jobDetails.parking_notified],
          ["Parking considerations / restrictions", jobDetails.parking_notes],
          ["Reported to site manager", jobDetails.reported_to_site_manager],
          ["Site manager name", jobDetails.site_manager_name],
          ["Site manager contact number", jobDetails.site_manager_phone],
          ["Revisit required", jobDetails.revisit_required],
          ["Issues found", jobDetails.issues_found],
          ["Issue detail", jobDetails.issue_detail],
          ["Engineer notes", jobDetails.engineer_notes],
        ]
      : [];

  if (formFields.length > 0) {
    doc.addPage();
    drawSectionBar(doc, "Form Details");
    for (const [label, value] of formFields) {
      const formatted = formatFieldValue(label, value);
      if (formatted !== null) fieldBlock(doc, label, formatted);
    }
  }

  // --- Photos and videos, each beside its own caption, GPS/timestamp overlay burned in ---
  if ((media ?? []).length > 0) {
    doc.addPage();
    drawSectionBar(doc, "Photos");
    for (const photo of media ?? []) {
      const bytes = await downloadBytes(supabase, photo.storage_path);
      if (!bytes) continue;
      const isVideo = photo.media_type === "video";
      manifest.push({ label: `${isVideo ? "Video" : "Photo"}: ${photo.slot}`, sha256: sha256Hex(bytes) });

      const caption = formatGpsTimestampOverlay(photo.latitude, photo.longitude, photo.captured_at);
      photoBlock(
        doc,
        humanize(photo.slot.replace("photo_", "")),
        caption,
        isVideo ? { bytes: null, isVideo: true } : { bytes, isVideo: false },
      );
    }
  }

  // --- Issues raised ---
  if (issues && issues.length > 0) {
    doc.addPage();
    drawSectionBar(doc, "Issues");
    for (const issue of issues) {
      fieldBlock(
        doc,
        `${humanize(issue.severity)} — ${humanize(issue.status ?? "")}`,
        issue.description,
        severityAccent(issue.severity),
      );
    }
  }

  // --- Hash manifest: proves what's actually embedded above ---
  doc.addPage();
  drawSectionBar(doc, "Verification");
  doc.fontSize(8).font("Courier");
  for (const entry of manifest) {
    doc.text(`${entry.sha256}  ${entry.label}`, { width: doc.page.width - PAGE_MARGINS.left - PAGE_MARGINS.right });
  }
  doc.font("Helvetica");

  drawFooters(doc);
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
