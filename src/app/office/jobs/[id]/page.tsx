import Link from "next/link";
import { notFound } from "next/navigation";
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

const INSTALL_PHOTO_SLOTS = [
  "photo_before",
  "photo_screen_mounted",
  "photo_player_installed",
  "photo_cable_management",
  "photo_content_on_screen",
  "photo_wide_shot",
];

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: job, error },
    { data: statusEvents },
    { data: installForm },
    { data: surveyForm },
    { data: media },
    { data: issues },
    { data: shareLinks },
    { data: jobTasks },
    { data: templates },
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
    supabase.from("media_assets").select("*").eq("job_id", id).order("slot"),
    supabase.from("issues").select("*, raised_by_user:users(name)").eq("job_id", id).order("created_at", { ascending: false }),
    supabase.from("share_links").select("token, expires_at, revoked").eq("job_id", id).order("created_at", { ascending: false }),
    supabase.from("job_tasks").select("id, label, is_done").eq("job_id", id).order("position"),
    supabase.from("job_templates").select("id, name").order("name"),
  ]);

  if (error || !job) notFound();

  const mediaBySlot = new Map((media ?? []).map((m) => [m.slot, m]));
  const base = appBaseUrl();
  const now = new Date().toISOString();
  const activeShareLinks = (shareLinks ?? [])
    .filter((link) => isShareLinkValid(link, now))
    .map((link) => ({ token: link.token, expires_at: link.expires_at, url: `${base}/share/${link.token}` }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">{job.job_number}</h1>
            <Badge variant="secondary">{job.status}</Badge>
            {job.qa_status !== "pending" && <Badge variant="outline">QA: {job.qa_status}</Badge>}
          </div>
          <p className="text-muted-foreground text-sm">
            {job.job_type} · Priority {job.priority} ·{" "}
            <Link href={`/office/jobs?project_id=${job.project_id ?? ""}`} className="underline">
              {job.project?.name ?? "No project"}
            </Link>
            {job.site?.client && (
              <>
                {" "}
                ·{" "}
                <Link href={`/office/clients/${job.site.client.id}`} className="underline">
                  {job.site.client.name}
                </Link>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="text-right text-sm">
            <p>Assigned: {job.assigned?.name ?? "Unassigned"}</p>
            <p className="text-muted-foreground">
              {job.scheduled_start ? new Date(job.scheduled_start).toLocaleString() : "Not scheduled"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <DuplicateJobButton jobId={job.id} />
            <CancelJobButton jobId={job.id} status={job.status} />
            <DeleteJobButton jobId={job.id} jobNumber={job.job_number} />
          </div>
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
          <ol className="flex flex-col gap-2">
            {(statusEvents ?? []).length === 0 && (
              <li className="text-muted-foreground text-sm">No status changes recorded yet.</li>
            )}
            {(statusEvents ?? []).map((event) => (
              <li key={event.id} className="border-l-2 pl-3 text-sm">
                <span className="font-medium">
                  {event.from_status ? `${event.from_status} → ` : ""}
                  {event.to_status}
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

      {(installForm || surveyForm) && (
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
              <FormField label="Player boot test" value={installForm.player_boot_test} />
              <FormField label="Content displaying" value={installForm.content_displaying} />
              <FormField label="Issues found" value={installForm.issues_found ? "Yes" : "No"} />
              <FormField label="Client name" value={installForm.client_name} />
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
        </section>
      )}

      <TaskPanel jobId={job.id} tasks={jobTasks ?? []} templates={templates ?? []} />

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Media</h2>
        {job.job_type === "install" ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {INSTALL_PHOTO_SLOTS.map((slot) => {
              const asset = mediaBySlot.get(slot);
              return (
                <div key={slot} className="flex flex-col gap-1 rounded-md border p-2 text-xs">
                  <div className="bg-muted flex h-20 items-center justify-center rounded text-muted-foreground">
                    {asset ? (asset.media_type === "video" ? "🎥" : "📷") : "—"}
                  </div>
                  <span className="font-medium">{slot.replace("photo_", "").replace(/_/g, " ")}</span>
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
        ) : (media ?? []).length === 0 ? (
          <p className="text-muted-foreground text-sm">No media captured yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {(media ?? []).map((asset) => (
              <div key={asset.id} className="flex flex-col gap-1 rounded-md border p-2 text-xs">
                <div className="bg-muted flex h-20 items-center justify-center rounded text-muted-foreground">
                  {asset.media_type === "video" ? "🎥" : "📷"}
                </div>
                <span className="font-medium">{asset.slot}</span>
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
                  {issue.severity}
                </Badge>
                <span className="text-muted-foreground">{issue.status}</span>
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
