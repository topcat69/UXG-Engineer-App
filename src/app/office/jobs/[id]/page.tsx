import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import SiteMap from "@/components/site-map-loader";
import { createClient } from "@/lib/supabase/server";
import { appBaseUrl } from "@/lib/app-url";
import { isShareLinkValid } from "@/lib/share-links/validity";
import { IssueForm } from "./issue-form";
import { CancelJobButton } from "./cancel-job-button";
import { DeleteJobButton } from "./delete-job-button";
import { DuplicateJobButton } from "./duplicate-job-button";
import { TaskPanel } from "./task-panel";
import { ShareLinkPanel } from "./share-link-panel";
import { JobDetailsPanel } from "./job-details-panel";
import { RequiredFieldsPanel } from "./required-fields-panel";
import { AssignSchedulePanel } from "./assign-schedule-panel";
import { EditJobPanel } from "./edit-job-panel";
import { showsAvFields, usesJobDetails, photoSlotsFor, type JobDetailsType, type RequirableFieldKey } from "@/lib/forms/job-form";
import { humanize } from "@/lib/format/text";
import { formatDurationBetween } from "@/lib/format/duration";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: job, error },
    { data: statusEvents },
    { data: installForm },
    { data: surveyForm },
    { data: jobDetails },
    { data: jobEquipment },
    { data: jobOptionalFields },
    { data: media },
    { data: issues },
    { data: shareLinks },
    { data: jobTasks },
    { data: templates },
    { data: engineers },
    { data: projects },
    { data: allSites },
  ] = await Promise.all([
    supabase
      .from("jobs")
      .select(
        "*, site:sites(*, client:clients(id, name)), project:projects(name), assigned:users!jobs_assigned_to_fkey(name, email)",
      )
      .eq("id", id)
      .single(),
    supabase
      .from("status_events")
      .select("*, user:users(name)")
      .eq("job_id", id)
      .order("occurred_at", { ascending: false }),
    supabase.from("install_forms").select("*").eq("job_id", id).maybeSingle(),
    supabase.from("survey_forms").select("*").eq("job_id", id).maybeSingle(),
    supabase.from("job_details").select("*").eq("job_id", id).maybeSingle(),
    supabase.from("job_equipment").select("id, model, serial").eq("job_id", id).order("position"),
    supabase.from("job_optional_fields").select("field_key").eq("job_id", id),
    supabase.from("media_assets").select("*").eq("job_id", id).order("slot"),
    supabase.from("issues").select("*, raised_by_user:users(name)").eq("job_id", id).order("created_at", { ascending: false }),
    supabase.from("share_links").select("token, expires_at, revoked").eq("job_id", id).order("created_at", { ascending: false }),
    supabase.from("job_tasks").select("id, label, is_done").eq("job_id", id).order("position"),
    supabase.from("job_templates").select("id, name").order("name"),
    supabase.from("users").select("id, name").in("role", ["engineer", "manager"]).eq("active", true).order("name"),
    supabase.from("projects").select("id, name, client_id").order("name"),
    supabase.from("sites").select("id, name, client_id").order("name"),
  ]);

  if (error || !job) notFound();

  // Revisit traceability: which job this one was raised from (if any), and
  // which job(s) were raised from this one (e.g. a QA rejection's follow-up).
  // Queried separately from the main batch since it needs job.parent_job_id,
  // which isn't known until the main query above resolves.
  const [{ data: parentJob }, { data: revisitChildren }] = await Promise.all([
    job.parent_job_id
      ? supabase.from("jobs").select("id, job_number").eq("id", job.parent_job_id).single()
      : Promise.resolve({ data: null }),
    supabase.from("jobs").select("id, job_number").eq("parent_job_id", id),
  ]);

  // Signed URLs so the office can actually see the photos/videos, not just
  // their slot placeholders — the Media section used to render an emoji box
  // for every asset and never fetch a viewable URL for any of them at all.
  // 1 hour matches the share page's TTL (share/[token]/page.tsx); this page
  // is loaded fresh on every visit, so there's no need for a longer one.
  const MEDIA_SIGNED_URL_TTL_SECONDS = 60 * 60;
  const mediaWithUrls = await Promise.all(
    (media ?? []).map(async (asset) => {
      const { data } = await supabase.storage.from("media").createSignedUrl(asset.storage_path, MEDIA_SIGNED_URL_TTL_SECONDS);
      return { ...asset, url: data?.signedUrl ?? null };
    }),
  );
  const mediaBySlot = new Map(mediaWithUrls.map((m) => [m.slot, m]));
  const travelDuration = formatDurationBetween(job.actual_travel_start, job.actual_start);
  const onSiteDuration = formatDurationBetween(job.actual_start, job.actual_end);
  const base = appBaseUrl();
  const now = new Date().toISOString();
  const activeShareLinks = (shareLinks ?? [])
    .filter((link) => isShareLinkValid(link, now))
    .map((link) => ({ token: link.token, expires_at: link.expires_at, url: `${base}/share/${link.token}` }));

  return (
    <div className="flex flex-col gap-6">
      {job.qa_status === "rejected" && job.qa_notes && (
        <div className="border-destructive/50 bg-destructive/5 rounded-md border p-3 text-sm">
          <p className="text-destructive font-medium">Rejected by QA</p>
          <p className="mt-1">{job.qa_notes}</p>
          {(revisitChildren ?? []).length > 0 && (
            <p className="text-muted-foreground mt-2">
              Revisit created:{" "}
              {(revisitChildren ?? []).map((child, i) => (
                <span key={child.id}>
                  {i > 0 && ", "}
                  <Link href={`/office/jobs/${child.id}`} className="underline">
                    {child.job_number}
                  </Link>
                </span>
              ))}
            </p>
          )}
        </div>
      )}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">{job.job_number}</h1>
            <Badge variant="secondary">{humanize(job.status)}</Badge>
            {job.qa_status !== "pending" && <Badge variant="outline">QA: {humanize(job.qa_status ?? "")}</Badge>}
            {parentJob && (
              <Link href={`/office/jobs/${parentJob.id}`} className="text-xs underline">
                Revisit of {parentJob.job_number}
              </Link>
            )}
            {job.qa_status !== "rejected" &&
              (revisitChildren ?? []).map((child) => (
                <Link key={child.id} href={`/office/jobs/${child.id}`} className="text-xs underline">
                  Revisit: {child.job_number}
                </Link>
              ))}
          </div>
          <EditJobPanel
            jobId={job.id}
            projectId={job.project_id}
            projectName={job.project?.name ?? null}
            clientId={job.site?.client?.id ?? null}
            clientName={job.site?.client?.name ?? null}
            siteId={job.site_id}
            siteName={job.site?.name ?? ""}
            jobType={job.job_type}
            priority={job.priority}
            description={job.description}
            quickbooksNo={job.quickbooks_no}
            projects={projects ?? []}
            sites={allSites ?? []}
          />
        </div>
        <div className="flex items-center gap-2">
          <DuplicateJobButton jobId={job.id} />
          <CancelJobButton jobId={job.id} status={job.status} />
          <DeleteJobButton jobId={job.id} jobNumber={job.job_number} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-2">
          <h2 className="font-medium">Site</h2>
          <p className="text-sm">
            {job.site?.name}
            {job.site?.client && <span className="text-muted-foreground"> ({job.site.client.name})</span>}
          </p>
          <p className="text-muted-foreground text-sm">
            {[job.site?.address_line1, job.site?.town, job.site?.postcode].filter(Boolean).join(", ")}
          </p>
          {job.site?.access_notes && (
            <p className="text-sm">
              <span className="text-muted-foreground">Access notes:</span> {job.site.access_notes}
            </p>
          )}
          {job.site?.latitude && job.site?.longitude ? (
            <SiteMap latitude={job.site.latitude} longitude={job.site.longitude} label={job.site.name} />
          ) : (
            <p className="text-muted-foreground text-sm">No coordinates on file for this site.</p>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-medium">Status timeline</h2>
          {(travelDuration || onSiteDuration) && (
            <div className="flex flex-col gap-0.5 text-sm">
              {travelDuration && (
                <p>
                  <span className="text-muted-foreground">Time travelling:</span> {travelDuration}
                </p>
              )}
              {onSiteDuration && (
                <p>
                  <span className="text-muted-foreground">Time on job:</span> {onSiteDuration}
                </p>
              )}
            </div>
          )}
          <ol className="flex flex-col gap-2">
            {(statusEvents ?? []).length === 0 && (
              <li className="text-muted-foreground text-sm">No status changes recorded yet.</li>
            )}
            {(statusEvents ?? []).map((event) => (
              <li key={event.id} className="border-l-2 pl-3 text-sm">
                <span className="font-medium">
                  {event.from_status ? `${humanize(event.from_status)} → ` : ""}
                  {humanize(event.to_status)}
                </span>
                <span className="text-muted-foreground">
                  {" "}
                  · {new Date(event.occurred_at).toLocaleString()}
                  {event.user?.name ? ` · ${event.user.name}` : ""}
                </span>
                {event.reason && <p className="text-muted-foreground">{event.reason}</p>}
              </li>
            ))}
          </ol>
        </section>
      </div>

      {(installForm || surveyForm || jobDetails) && (
        <section className="flex flex-col gap-2">
          <h2 className="font-medium">Form data</h2>
          {installForm && (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
              <FormField label="Player serial" value={installForm.player_serial} />
              <FormField label="Screen serial" value={installForm.screen_serial} />
              <FormField label="Mount type" value={installForm.mount_type} />
              <FormField label="Power source" value={installForm.power_source} />
              <FormField label="Network" value={installForm.network_type} />
              <FormField label="WiFi signal" value={installForm.wifi_signal} />
              <FormField label="Network port" value={installForm.network_port} />
              <FormField label="Player boot test" value={humanize(installForm.player_boot_test ?? "")} />
              <FormField label="Content displaying" value={humanize(installForm.content_displaying ?? "")} />
              <FormField label="Issues found" value={installForm.issues_found ? "Yes" : "No"} />
              <FormField label="Equipment damage" value={installForm.equipment_damage ? humanize(installForm.equipment_damage) : null} />
              <FormField label="Customer name" value={installForm.client_name} />
            </dl>
          )}
          {surveyForm && (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
              <FormField label="Mounting surface" value={surveyForm.mounting_surface} />
              <FormField label="Power available" value={surveyForm.power_available ? "Yes" : "No"} />
              <FormField label="Network available" value={surveyForm.network_available ? "Yes" : "No"} />
              <FormField label="Access restrictions" value={surveyForm.access_restrictions} />
              <FormField label="Measurements" value={surveyForm.measurements} />
            </dl>
          )}
          {jobDetails && (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
              {usesJobDetails(job.job_type) && showsAvFields(job.job_type) && (
                <>
                  <FormField label="Player serial" value={jobDetails.player_serial} />
                  <FormField label="Screen serial" value={jobDetails.screen_serial} />
                  <FormField label="Mount type" value={jobDetails.mount_type} />
                  <FormField label="Power source" value={jobDetails.power_source} />
                  <FormField label="Network" value={jobDetails.network_type} />
                  <FormField label="WiFi signal" value={jobDetails.wifi_signal} />
                  <FormField label="Network port" value={jobDetails.network_port} />
                  <FormField label="Player boot test" value={humanize(jobDetails.player_boot_test ?? "")} />
                  <FormField label="Content displaying" value={humanize(jobDetails.content_displaying ?? "")} />
                </>
              )}
              <FormField label="Parking notified" value={jobDetails.parking_notified ? "Yes" : "No"} />
              <FormField label="Parking considerations / restrictions" value={jobDetails.parking_notes} />
              <FormField label="Reported to site manager" value={jobDetails.reported_to_site_manager ? "Yes" : "No"} />
              <FormField label="Site manager name" value={jobDetails.site_manager_name} />
              <FormField label="Site manager contact number" value={jobDetails.site_manager_phone} />
              {jobDetails.revisit_required !== null && (
                <FormField label="Revisit required" value={jobDetails.revisit_required ? "Yes" : "No"} />
              )}
              <FormField label="Issues found" value={jobDetails.issues_found ? "Yes" : "No"} />
              {jobDetails.issues_found && <FormField label="Issue detail" value={jobDetails.issue_detail} />}
              <FormField label="Equipment damage" value={jobDetails.equipment_damage ? humanize(jobDetails.equipment_damage) : null} />
              <FormField label="Engineer notes" value={jobDetails.engineer_notes} />
            </dl>
          )}
        </section>
      )}

      <JobDetailsPanel
        jobId={job.id}
        jobType={job.job_type as JobDetailsType}
        jobDetails={jobDetails ?? null}
        equipment={jobEquipment ?? []}
      />

      <RequiredFieldsPanel
        jobId={job.id}
        jobType={job.job_type}
        optionalKeys={(jobOptionalFields ?? []).map((row) => row.field_key as RequirableFieldKey)}
      />

      <TaskPanel jobId={job.id} tasks={jobTasks ?? []} templates={templates ?? []} />

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Media</h2>
        {usesJobDetails(job.job_type) ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {photoSlotsFor(job.job_type as JobDetailsType).map((slot) => {
              const asset = mediaBySlot.get(slot);
              return (
                <div key={slot} className="flex flex-col gap-1 rounded-md border p-2 text-xs">
                  <MediaThumbnail asset={asset ?? null} />
                  <span className="font-medium">{humanize(slot.replace("photo_", ""))}</span>
                  {asset ? (
                    <span className="text-muted-foreground">
                      {new Date(asset.captured_at).toLocaleDateString()}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Not captured</span>
                  )}
                </div>
              );
            })}
          </div>
        ) : mediaWithUrls.length === 0 ? (
          <p className="text-muted-foreground text-sm">No media captured yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {mediaWithUrls.map((asset) => (
              <div key={asset.id} className="flex flex-col gap-1 rounded-md border p-2 text-xs">
                <MediaThumbnail asset={asset} />
                <span className="font-medium">{humanize(asset.slot.replace("photo_", ""))}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Issues</h2>
        {(issues ?? []).length === 0 && <p className="text-muted-foreground text-sm">No issues raised.</p>}
        <ul className="flex flex-col gap-2">
          {(issues ?? []).map((issue) => (
            <li key={issue.id} className="rounded-md border p-3 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant={issue.severity === "critical" || issue.severity === "high" ? "destructive" : "secondary"}>
                  {humanize(issue.severity)}
                </Badge>
                <span className="text-muted-foreground">{humanize(issue.status ?? "")}</span>
                <span className="text-muted-foreground">
                  · {issue.created_at ? new Date(issue.created_at).toLocaleDateString() : "unknown date"}
                  {issue.raised_by_user?.name ? ` · ${issue.raised_by_user.name}` : ""}
                </span>
              </div>
              <p className="mt-1">{issue.description}</p>
            </li>
          ))}
        </ul>
        {job.site_id && <IssueForm jobId={job.id} siteId={job.site_id} />}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Assign &amp; schedule</h2>
        <p className="text-muted-foreground text-sm">
          Save this once everything above (RAMS, site plan, job information, equipment) is ready — scheduling sends
          the &quot;New Job Scheduled&quot; email to the assigned engineer with whatever&apos;s attached at that
          point.
        </p>
        <AssignSchedulePanel
          jobId={job.id}
          assignedTo={job.assigned_to}
          assignedName={job.assigned?.name ?? null}
          scheduledStart={job.scheduled_start}
          scheduledEnd={job.scheduled_end}
          isProvisional={job.status === "provisional"}
          engineers={engineers ?? []}
        />
      </section>

      <ShareLinkPanel jobId={job.id} links={activeShareLinks} />
    </div>
  );
}

function FormField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value || "—"}</dd>
    </div>
  );
}

/**
 * Photos get a real thumbnail (signed URL, so it's time-limited — see the
 * TTL comment above); a video's byte stream isn't cheap to thumbnail here,
 * so it gets a play icon instead, both opening the full-size original in a
 * new tab. An asset whose signed URL failed to generate (or that hasn't
 * been captured for this slot at all) falls back to a plain placeholder —
 * never a broken image.
 */
function MediaThumbnail({ asset }: { asset: { media_type: string; url: string | null } | null }) {
  if (!asset || !asset.url) {
    return (
      <div className="bg-muted flex h-20 items-center justify-center rounded text-muted-foreground">
        {asset ? (asset.media_type === "video" ? "🎥" : "📷") : "—"}
      </div>
    );
  }
  return (
    <a href={asset.url} target="_blank" rel="noreferrer" className="block h-20 overflow-hidden rounded">
      {asset.media_type === "video" ? (
        <div className="bg-muted flex h-full items-center justify-center text-muted-foreground">🎥 View video</div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- signed, time-limited storage URL; not worth Next/Image's remote-pattern config for this.
        <img src={asset.url} alt="" className="h-full w-full object-cover" />
      )}
    </a>
  );
}
