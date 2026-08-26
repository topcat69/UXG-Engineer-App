"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { CurrentUser } from "@/lib/auth/current-user";
import { db, type InstallFormRow, type JobDetailsRow, type MediaQueueItem } from "@/lib/offline/db";
import { generateId } from "@/lib/offline/id";
import {
  checkIn,
  pauseJob,
  resumeJob,
  saveInstallFormDraft,
  saveJobDetailsDraft,
  startTravelling,
  submitJob,
  submitJobDetails,
  toggleTask,
} from "@/lib/offline/field-actions";
import { getCurrentPosition, resolveJobLocation, siteLocationFallback } from "@/lib/offline/media-capture";
import { distanceMeters } from "@/lib/geo/distance";
import { humanize } from "@/lib/format/text";
import {
  EMPTY_INSTALL_FORM,
  MOUNT_TYPES,
  NETWORK_TYPES,
  PASS_FAIL,
  PHOTO_SLOTS,
  POWER_SOURCES,
  WIFI_SIGNALS,
  installFormRowToValues,
  showIssueDetail as showIssueDetailInstall,
  showNetworkPort as showNetworkPortInstall,
  showWifiSignal as showWifiSignalInstall,
  validateInstallForm,
  type InstallFormValues,
} from "@/lib/forms/install-form";
import {
  EMPTY_JOB_DETAILS,
  jobDetailsRowToValues,
  photoSlotsFor,
  showIssueDetail as showIssueDetailJobDetails,
  showNetworkPort as showNetworkPortJobDetails,
  showWifiSignal as showWifiSignalJobDetails,
  showsAvFields,
  showsIssuesSection,
  showsRevisitRequired,
  showsSiteplanAndEquipment,
  showsSlaRequirement,
  usesJobDetails,
  validateJobDetails,
  type JobDetailsType,
  type JobDetailsValues,
} from "@/lib/forms/job-form";
import SiteMap from "@/components/site-map-loader";
import { BarcodeScanButton } from "./barcode-scan-button";
import { PhotoSlot } from "./photo-slot";
import { SignatureCapture } from "./signature-capture";

const AUTOSAVE_INTERVAL_MS = 15_000;
// Two distinct spec-required timestamps, two distinct pre-site statuses:
// BEFORE_TRAVEL shows "Start Travelling" (-> "travelling", actual_travel_start);
// once "travelling", the Check In button below takes over (-> "in_progress", actual_start).
// "provisional" is deliberately excluded — that's what blocks an engineer
// from starting a provisional job until the office confirms it.
const BEFORE_TRAVEL: readonly string[] = ["draft", "scheduled", "dispatched", "accepted"];
const NOT_YET_ON_SITE: readonly string[] = [...BEFORE_TRAVEL, "travelling"];

export function JobWorkflow({
  jobId,
  currentUser,
  onBack,
  onMutated,
}: {
  jobId: string;
  currentUser: CurrentUser;
  onBack: () => void;
  /** Fired after any local mutation (check-in, capture, submit) so the sync
   * engine can attempt an immediate, opportunistic upload rather than
   * waiting for the next periodic trigger. */
  onMutated?: () => void;
}) {
  const job = useLiveQuery(() => db.jobs.get(jobId), [jobId]);
  const site = useLiveQuery(() => (job ? db.sites.get(job.site_id) : undefined), [job?.site_id]);
  const client = useLiveQuery(() => (site ? db.clients.get(site.client_id) : undefined), [site?.client_id]);
  const formRow = useLiveQuery(() => db.installForms.where("job_id").equals(jobId).first(), [jobId]);
  const detailsRow = useLiveQuery(() => db.jobDetails.where("job_id").equals(jobId).first(), [jobId]);
  const equipment = useLiveQuery(() => db.jobEquipment.where("job_id").equals(jobId).sortBy("position"), [jobId], []);
  const optionalFieldRows = useLiveQuery(() => db.jobOptionalFields.where("job_id").equals(jobId).toArray(), [jobId], []);
  const media = useLiveQuery(() => db.mediaQueue.where("jobId").equals(jobId).toArray(), [jobId], []);
  const tasks = useLiveQuery(() => db.jobTasks.where("job_id").equals(jobId).sortBy("position"), [jobId], []);

  const jobType = job?.job_type ?? "";
  const detailsMode = usesJobDetails(jobType);

  // Two parallel form-state slots — only one is ever rendered/used, per
  // detailsMode, but hooks can't be called conditionally, so both exist
  // unconditionally and the unused one just sits idle at its empty default.
  const [installValues, setInstallValues] = useState<InstallFormValues>(EMPTY_INSTALL_FORM);
  const [detailsValues, setDetailsValues] = useState<JobDetailsValues>(EMPTY_JOB_DETAILS);
  const [isStartingTravel, setIsStartingTravel] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [travelError, setTravelError] = useState<string | null>(null);
  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [confirmingPause, setConfirmingPause] = useState(false);
  const [pauseReason, setPauseReason] = useState("");
  const [isPausing, setIsPausing] = useState(false);
  const [pauseError, setPauseError] = useState<string | null>(null);
  const [isResuming, setIsResuming] = useState(false);
  const hydrated = useRef(false);

  // Hydrate local edit state from Dexie once per job, not on every autosave echo.
  useEffect(() => {
    hydrated.current = false;
  }, [jobId]);
  useEffect(() => {
    if (hydrated.current || !detailsMode || detailsRow === undefined) return;
    setDetailsValues(jobDetailsRowToValues(detailsRow));
    hydrated.current = true;
  }, [detailsMode, detailsRow]);
  useEffect(() => {
    if (hydrated.current || detailsMode || formRow === undefined) return;
    setInstallValues(installFormRowToValues(formRow));
    hydrated.current = true;
  }, [detailsMode, formRow]);

  // Grouped by slot (not a single latest-wins entry) so every captured item
  // shows up — a slot can hold more than one photo. Video is included here
  // too: it was previously filtered out despite PhotoSlot having a video
  // icon branch, so a captured video never actually appeared as captured.
  const mediaBySlot = new Map<string, MediaQueueItem[]>();
  for (const m of media ?? []) {
    if (m.kind !== "photo" && m.kind !== "video") continue;
    const list = mediaBySlot.get(m.slot);
    if (list) list.push(m);
    else mediaBySlot.set(m.slot, [m]);
  }
  const signature = (media ?? []).find((m) => m.kind === "signature");

  function currentInstallRow(): InstallFormRow {
    return {
      id: formRow?.id ?? generateId(),
      job_id: jobId,
      player_serial: installValues.player_serial || null,
      screen_serial: installValues.screen_serial || null,
      mount_type: installValues.mount_type || null,
      power_source: installValues.power_source || null,
      network_type: installValues.network_type || null,
      wifi_signal: installValues.wifi_signal || null,
      network_port: installValues.network_port || null,
      player_boot_test: (installValues.player_boot_test || null) as InstallFormRow["player_boot_test"],
      content_displaying: (installValues.content_displaying || null) as InstallFormRow["content_displaying"],
      issues_found: installValues.issues_found,
      issue_detail: installValues.issue_detail || null,
      engineer_notes: installValues.engineer_notes || null,
      client_name: installValues.client_name || null,
      submitted_at: formRow?.submitted_at ?? null,
      created_at: formRow?.created_at ?? new Date().toISOString(),
    };
  }

  function currentDetailsRow(): JobDetailsRow {
    return {
      id: detailsRow?.id ?? generateId(),
      job_id: jobId,
      player_serial: detailsValues.player_serial || null,
      screen_serial: detailsValues.screen_serial || null,
      mount_type: detailsValues.mount_type || null,
      power_source: detailsValues.power_source || null,
      network_type: detailsValues.network_type || null,
      wifi_signal: detailsValues.wifi_signal || null,
      network_port: detailsValues.network_port || null,
      player_boot_test: (detailsValues.player_boot_test || null) as JobDetailsRow["player_boot_test"],
      content_displaying: (detailsValues.content_displaying || null) as JobDetailsRow["content_displaying"],
      rams_storage_path: detailsRow?.rams_storage_path ?? null,
      site_plan_storage_path: detailsRow?.site_plan_storage_path ?? null,
      sla_requirement_detail: detailsRow?.sla_requirement_detail ?? null,
      job_information: detailsRow?.job_information ?? null,
      parking_notified: detailsValues.parking_notified,
      parking_notes: detailsValues.parking_notes || null,
      reported_to_site_manager: detailsValues.reported_to_site_manager,
      site_manager_name: detailsValues.site_manager_name || null,
      site_manager_phone: detailsValues.site_manager_phone || null,
      revisit_required: detailsValues.revisit_required === "" ? null : detailsValues.revisit_required === "yes",
      issues_found: detailsValues.issues_found,
      issue_detail: detailsValues.issue_detail || null,
      engineer_notes: detailsValues.engineer_notes || null,
      submitted_at: detailsRow?.submitted_at ?? null,
      created_at: detailsRow?.created_at ?? new Date().toISOString(),
    };
  }

  // 15-second autosave, surviving force-quit: Dexie writes are durable
  // IndexedDB writes, so whatever made it into the last tick is safe even
  // if the tab is killed a moment later.
  useEffect(() => {
    if (!job || NOT_YET_ON_SITE.includes(job.status)) return;
    const interval = setInterval(() => {
      if (detailsMode) saveJobDetailsDraft(currentDetailsRow());
      else saveInstallFormDraft(currentInstallRow());
    }, AUTOSAVE_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.status, installValues, detailsValues, detailsMode]);

  if (job === undefined || site === undefined) {
    return <p className="text-muted-foreground p-4 text-sm">Loading…</p>;
  }
  if (!job) {
    return (
      <div className="p-4">
        <button type="button" onClick={onBack} className="text-muted-foreground text-sm underline">
          ← Back
        </button>
        <p className="mt-2 text-sm">Job not found offline yet. Reconnect to sync.</p>
      </div>
    );
  }

  async function handleStartTravel() {
    setIsStartingTravel(true);
    setTravelError(null);
    try {
      const point = await resolveJobLocation(site);
      if (!point) {
        setTravelError(
          "Location is required to start travelling — enable location services, or make sure this site has a postcode set, and try again.",
        );
        return;
      }
      await startTravelling(jobId, point);
      onMutated?.();
    } catch (err) {
      setTravelError(err instanceof Error ? err.message : "Something went wrong starting travel — please try again.");
    } finally {
      setIsStartingTravel(false);
    }
  }

  async function handleCheckIn() {
    setIsCheckingIn(true);
    setCheckInError(null);
    try {
      // Geofence variance only means anything against a *live* fix — a
      // fallback derived from the site's own coordinates would always
      // compare the site to itself and report a false "on site" of 0m.
      const position = await getCurrentPosition();
      let geofenceVarianceM: number | null = null;
      let point: { latitude: number; longitude: number } | null = null;
      if (position) {
        point = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        if (site?.latitude != null && site?.longitude != null) {
          geofenceVarianceM = distanceMeters(point.latitude, point.longitude, site.latitude, site.longitude);
        }
      } else {
        point = await siteLocationFallback(site);
      }
      if (!point) {
        setCheckInError(
          "Location is required to check in — enable location services, or make sure this site has a postcode set, and try again.",
        );
        return;
      }
      await checkIn(jobId, geofenceVarianceM, point);
      onMutated?.();
    } catch (err) {
      setCheckInError(err instanceof Error ? err.message : "Something went wrong checking in — please try again.");
    } finally {
      setIsCheckingIn(false);
    }
  }

  async function handlePause() {
    if (!pauseReason.trim()) return;
    setIsPausing(true);
    try {
      await pauseJob(jobId, pauseReason.trim());
      setPauseReason("");
      setConfirmingPause(false);
      onMutated?.();
    } catch (err) {
      setPauseError(err instanceof Error ? err.message : "Something went wrong pausing — please try again.");
    } finally {
      setIsPausing(false);
    }
  }

  async function handleResume() {
    setIsResuming(true);
    try {
      await resumeJob(jobId);
      onMutated?.();
    } catch {
      // best-effort UI feedback only — resumeJob's own outbox op retries automatically, same as every other field action
    } finally {
      setIsResuming(false);
    }
  }

  async function handleToggleTask(taskId: string, isDone: boolean) {
    await toggleTask(taskId, jobId, isDone, currentUser.id);
    onMutated?.();
  }

  async function handleSubmit() {
    const capturedSlots = new Set(mediaBySlot.keys());
    let validationErrors: string[];
    if (detailsMode) {
      const optionalKeys = new Set((optionalFieldRows ?? []).map((row) => row.field_key));
      validationErrors = validateJobDetails(jobType as JobDetailsType, detailsValues, capturedSlots, !!signature, optionalKeys);
    } else {
      validationErrors = validateInstallForm(installValues, capturedSlots, !!signature);
    }
    const incompleteTasks = (tasks ?? []).filter((t) => !t.is_done);
    if (incompleteTasks.length > 0) {
      validationErrors.push(
        incompleteTasks.length === 1
          ? "1 task is not yet checked off."
          : `${incompleteTasks.length} tasks are not yet checked off.`,
      );
    }
    // Resolved here (not deferred into the try block below) so a missing
    // location shows up alongside every other reason submission is
    // blocked, rather than failing silently after the office believes the
    // form was otherwise ready. Falls back to the site's known location
    // (or its geocoded postcode) if live GPS isn't available — see
    // resolveJobLocation.
    const point = await resolveJobLocation(site);
    if (!point) {
      validationErrors.push(
        "Location is required — enable location services, or make sure this site has a postcode set, and try again.",
      );
    }
    setErrors(validationErrors);
    if (validationErrors.length > 0 || !point) return;

    setIsSubmitting(true);
    try {
      if (detailsMode) {
        await saveJobDetailsDraft(currentDetailsRow());
        await submitJobDetails(jobId, jobType as JobDetailsType, currentDetailsRow(), point, currentUser.id);
      } else {
        await saveInstallFormDraft(currentInstallRow());
        await submitJob(jobId, currentInstallRow(), point, currentUser.id);
      }
      onMutated?.();
    } catch (err) {
      setErrors([err instanceof Error ? err.message : "Something went wrong submitting — please try again."]);
    } finally {
      setIsSubmitting(false);
    }
  }

  const onSite = job.status === "on_site" || job.status === "in_progress";

  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      <button type="button" onClick={onBack} className="text-muted-foreground text-sm underline">
        ← Back
      </button>

      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">{job.job_number}</h1>
          <Badge variant="secondary">{humanize(job.status)}</Badge>
        </div>
        <p className="text-muted-foreground text-sm">{client ? `${client.name} — ${site?.name}` : site?.name}</p>
        <p className="text-muted-foreground text-sm">
          {[site?.address_line1, site?.town, site?.postcode].filter(Boolean).join(", ")}
        </p>
        {site?.latitude && site?.longitude && (
          <div className="mt-2">
            <SiteMap latitude={site.latitude} longitude={site.longitude} label={site.name} />
          </div>
        )}
      </div>

      {job.status === "provisional" && (
        <p className="text-muted-foreground text-sm">
          This job is provisional and hasn&apos;t been confirmed yet — you&apos;ll be able to start travelling once
          the office changes it to scheduled.
        </p>
      )}

      {BEFORE_TRAVEL.includes(job.status) && (
        <div className="flex flex-col gap-2">
          <Button onClick={handleStartTravel} disabled={isStartingTravel}>
            {isStartingTravel ? "Starting…" : "Start Travelling"}
          </Button>
          {travelError && <p className="text-destructive text-sm">{travelError}</p>}
        </div>
      )}

      {job.status === "travelling" && (
        <div className="flex flex-col gap-2">
          <Button onClick={handleCheckIn} disabled={isCheckingIn}>
            {isCheckingIn ? "Checking in…" : "Check In & Start Work"}
          </Button>
          {checkInError && <p className="text-destructive text-sm">{checkInError}</p>}
        </div>
      )}

      {job.status === "on_hold" && (
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-sm">This job is paused. Resume to carry on where you left off.</p>
          <Button onClick={handleResume} disabled={isResuming}>
            {isResuming ? "Resuming…" : "Resume Job"}
          </Button>
        </div>
      )}

      {job.status === "in_progress" &&
        (confirmingPause ? (
          <div className="flex flex-col gap-2 rounded-md border p-3">
            <Textarea
              value={pauseReason}
              onChange={(e) => setPauseReason(e.target.value)}
              placeholder="Reason for pausing (required) — e.g. waiting on parts, end of shift, site closed"
              rows={2}
            />
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmingPause(false)}>
                Never mind
              </Button>
              <Button type="button" size="sm" disabled={isPausing || !pauseReason.trim()} onClick={handlePause}>
                {isPausing ? "Pausing…" : "Confirm pause"}
              </Button>
            </div>
            {pauseError && <p className="text-destructive text-sm">{pauseError}</p>}
          </div>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={() => setConfirmingPause(true)}>
            Pause job
          </Button>
        ))}

      {onSite && !detailsMode && (
        <InstallFormSection
          jobId={jobId}
          currentUser={currentUser}
          values={installValues}
          setValues={setInstallValues}
          tasks={tasks ?? []}
          onToggleTask={handleToggleTask}
          mediaBySlot={mediaBySlot}
          signature={signature}
          onMutated={onMutated}
          errors={errors}
          isSubmitting={isSubmitting}
          onSubmit={handleSubmit}
        />
      )}

      {onSite && detailsMode && (
        <JobDetailsSection
          jobId={jobId}
          jobType={jobType as JobDetailsType}
          currentUser={currentUser}
          site={site}
          values={detailsValues}
          setValues={setDetailsValues}
          detailsRow={detailsRow}
          equipment={equipment ?? []}
          tasks={tasks ?? []}
          onToggleTask={handleToggleTask}
          mediaBySlot={mediaBySlot}
          signature={signature}
          onMutated={onMutated}
          errors={errors}
          isSubmitting={isSubmitting}
          onSubmit={handleSubmit}
        />
      )}

      {job.status !== "provisional" && !NOT_YET_ON_SITE.includes(job.status) && !onSite && (
        <p className="text-muted-foreground text-sm">
          This job is {job.status.replace("_", " ")}. No further action needed here.
        </p>
      )}
    </div>
  );
}

/** The pre-existing install form flow, unchanged — this only renders for job_type "survey" now, since "install" moved to JobDetailsSection below. Kept exactly as-is rather than reworked, since survey's own field-app rendering was never built to begin with (a pre-existing gap this change doesn't touch). */
function InstallFormSection({
  jobId,
  currentUser,
  values,
  setValues,
  tasks,
  onToggleTask,
  mediaBySlot,
  signature,
  onMutated,
  errors,
  isSubmitting,
  onSubmit,
}: {
  jobId: string;
  currentUser: CurrentUser;
  values: InstallFormValues;
  setValues: React.Dispatch<React.SetStateAction<InstallFormValues>>;
  tasks: { id: string; label: string; is_done: boolean }[];
  onToggleTask: (taskId: string, isDone: boolean) => void;
  mediaBySlot: Map<string, MediaQueueItem[]>;
  signature: MediaQueueItem | undefined;
  onMutated?: () => void;
  errors: string[];
  isSubmitting: boolean;
  onSubmit: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {tasks.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium">Tasks</p>
          <ul className="flex flex-col gap-2">
            {tasks.map((task) => (
              <li key={task.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                <input
                  type="checkbox"
                  checked={task.is_done}
                  onChange={(e) => onToggleTask(task.id, e.target.checked)}
                  className="h-4 w-4"
                />
                <span className={task.is_done ? "text-muted-foreground line-through" : ""}>{task.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Field label="Player serial">
        <div className="flex gap-2">
          <input
            value={values.player_serial}
            onChange={(e) => setValues((v) => ({ ...v, player_serial: e.target.value }))}
            className="border-input h-9 flex-1 rounded-md border bg-transparent px-2 text-sm"
          />
          <BarcodeScanButton onScan={(v) => setValues((prev) => ({ ...prev, player_serial: v }))} />
        </div>
      </Field>

      <Field label="Screen serial">
        <div className="flex gap-2">
          <input
            value={values.screen_serial}
            onChange={(e) => setValues((v) => ({ ...v, screen_serial: e.target.value }))}
            className="border-input h-9 flex-1 rounded-md border bg-transparent px-2 text-sm"
          />
          <BarcodeScanButton onScan={(v) => setValues((prev) => ({ ...prev, screen_serial: v }))} />
        </div>
      </Field>

      <Field label="Mount type">
        <Select value={values.mount_type} options={MOUNT_TYPES} onChange={(v) => setValues((prev) => ({ ...prev, mount_type: v }))} />
      </Field>

      <Field label="Power source">
        <Select value={values.power_source} options={POWER_SOURCES} onChange={(v) => setValues((prev) => ({ ...prev, power_source: v }))} />
      </Field>

      <Field label="Network">
        <Select value={values.network_type} options={NETWORK_TYPES} onChange={(v) => setValues((prev) => ({ ...prev, network_type: v }))} />
      </Field>

      {showWifiSignalInstall(values) && (
        <Field label="WiFi signal">
          <Select value={values.wifi_signal} options={WIFI_SIGNALS} onChange={(v) => setValues((prev) => ({ ...prev, wifi_signal: v }))} />
        </Field>
      )}

      {showNetworkPortInstall(values) && (
        <Field label="Network port">
          <input
            value={values.network_port}
            onChange={(e) => setValues((v) => ({ ...v, network_port: e.target.value }))}
            className="border-input h-9 w-full rounded-md border bg-transparent px-2 text-sm"
          />
        </Field>
      )}

      <Field label="Player boot test">
        <Select value={values.player_boot_test} options={PASS_FAIL} onChange={(v) => setValues((prev) => ({ ...prev, player_boot_test: v }))} labelFor={humanize} />
      </Field>

      <Field label="Content displaying">
        <Select value={values.content_displaying} options={PASS_FAIL} onChange={(v) => setValues((prev) => ({ ...prev, content_displaying: v }))} labelFor={humanize} />
      </Field>

      <PhotoGrid jobId={jobId} slots={PHOTO_SLOTS} currentUser={currentUser} mediaBySlot={mediaBySlot} onMutated={onMutated} />

      <Field label="Issues found?">
        <YesNoButtons
          value={values.issues_found}
          onChange={(v) => setValues((prev) => ({ ...prev, issues_found: v, issue_detail: v ? prev.issue_detail : "" }))}
        />
      </Field>

      {showIssueDetailInstall(values) && (
        <Field label="Issue detail">
          <Textarea value={values.issue_detail} onChange={(e) => setValues((v) => ({ ...v, issue_detail: e.target.value }))} />
        </Field>
      )}

      <Field label="Engineer notes">
        <Textarea value={values.engineer_notes} onChange={(e) => setValues((v) => ({ ...v, engineer_notes: e.target.value }))} />
      </Field>

      <Field label="Client name">
        <input
          value={values.client_name}
          onChange={(e) => setValues((v) => ({ ...v, client_name: e.target.value }))}
          className="border-input h-9 w-full rounded-md border bg-transparent px-2 text-sm"
        />
      </Field>

      <div>
        <p className="mb-2 text-sm font-medium">Client signature</p>
        <SignatureCapture jobId={jobId} capturedBy={currentUser.id} captured={!!signature} clientName={values.client_name} onCaptured={onMutated} />
      </div>

      <SubmitSection errors={errors} isSubmitting={isSubmitting} onSubmit={onSubmit} />
    </div>
  );
}

/** install/sla/maintenance/delivery — one form, sections shown/hidden per job type via job-form.ts's show* helpers. */
function JobDetailsSection({
  jobId,
  jobType,
  currentUser,
  site,
  values,
  setValues,
  detailsRow,
  equipment,
  tasks,
  onToggleTask,
  mediaBySlot,
  signature,
  onMutated,
  errors,
  isSubmitting,
  onSubmit,
}: {
  jobId: string;
  jobType: JobDetailsType;
  currentUser: CurrentUser;
  site:
    | {
        name: string;
        contact_name?: string | null;
        contact_phone?: string | null;
        contact_email?: string | null;
        access_notes?: string | null;
      }
    | undefined;
  values: JobDetailsValues;
  setValues: React.Dispatch<React.SetStateAction<JobDetailsValues>>;
  detailsRow: JobDetailsRow | undefined;
  equipment: { id: string; model: string; serial: string | null }[];
  tasks: { id: string; label: string; is_done: boolean }[];
  onToggleTask: (taskId: string, isDone: boolean) => void;
  mediaBySlot: Map<string, MediaQueueItem[]>;
  signature: MediaQueueItem | undefined;
  onMutated?: () => void;
  errors: string[];
  isSubmitting: boolean;
  onSubmit: () => void;
}) {
  const slots = photoSlotsFor(jobType);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border p-3">
        <p className="mb-2 text-sm font-medium">Job Information</p>
        {detailsRow?.job_information && (
          <p className="mb-2 text-sm whitespace-pre-wrap">{detailsRow.job_information}</p>
        )}
        <p className="text-sm">
          Customer contact: {[site?.contact_name, site?.contact_phone, site?.contact_email].filter(Boolean).join(" · ") || "Not on file"}
        </p>
        <p className="text-sm">RAMS: {detailsRow?.rams_storage_path ? "Attached — view in office system" : "Not attached"}</p>
        {site?.access_notes && (
          <p className="mt-2 text-sm">
            <span className="text-muted-foreground">Particular instructions:</span> {site.access_notes}
          </p>
        )}
        {showsSiteplanAndEquipment(jobType) && (
          <>
            <p className="text-sm">Site plan: {detailsRow?.site_plan_storage_path ? "Attached — view in office system" : "Not attached"}</p>
            {equipment.length > 0 && (
              <div className="mt-2">
                <p className="text-sm font-medium">Equipment list</p>
                <ul className="list-disc pl-5 text-sm">
                  {equipment.map((e) => (
                    <li key={e.id}>
                      {e.model}
                      {e.serial ? ` — ${e.serial}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
        {showsSlaRequirement(jobType) && detailsRow?.sla_requirement_detail && (
          <p className="mt-2 text-sm">
            <span className="text-muted-foreground">SLA requirement:</span> {detailsRow.sla_requirement_detail}
          </p>
        )}
      </div>

      {tasks.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium">Tasks</p>
          <ul className="flex flex-col gap-2">
            {tasks.map((task) => (
              <li key={task.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                <input type="checkbox" checked={task.is_done} onChange={(e) => onToggleTask(task.id, e.target.checked)} className="h-4 w-4" />
                <span className={task.is_done ? "text-muted-foreground line-through" : ""}>{task.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Field label="Parking notified">
        <YesNoButtons value={values.parking_notified} onChange={(v) => setValues((prev) => ({ ...prev, parking_notified: v }))} />
      </Field>
      <Field label="Parking considerations / restrictions">
        <Textarea value={values.parking_notes} onChange={(e) => setValues((v) => ({ ...v, parking_notes: e.target.value }))} />
      </Field>

      <Field label="Reported to site manager">
        <YesNoButtons value={values.reported_to_site_manager} onChange={(v) => setValues((prev) => ({ ...prev, reported_to_site_manager: v }))} />
      </Field>
      <Field label="Site manager name">
        <input
          value={values.site_manager_name}
          onChange={(e) => setValues((v) => ({ ...v, site_manager_name: e.target.value }))}
          className="border-input h-9 w-full rounded-md border bg-transparent px-2 text-sm"
        />
      </Field>
      <Field label="Site manager contact number">
        <input
          value={values.site_manager_phone}
          onChange={(e) => setValues((v) => ({ ...v, site_manager_phone: e.target.value }))}
          className="border-input h-9 w-full rounded-md border bg-transparent px-2 text-sm"
        />
      </Field>

      {showsAvFields(jobType) && (
        <>
          <Field label="Player serial">
            <div className="flex gap-2">
              <input
                value={values.player_serial}
                onChange={(e) => setValues((v) => ({ ...v, player_serial: e.target.value }))}
                className="border-input h-9 flex-1 rounded-md border bg-transparent px-2 text-sm"
              />
              <BarcodeScanButton onScan={(v) => setValues((prev) => ({ ...prev, player_serial: v }))} />
            </div>
          </Field>
          <Field label="Screen serial">
            <div className="flex gap-2">
              <input
                value={values.screen_serial}
                onChange={(e) => setValues((v) => ({ ...v, screen_serial: e.target.value }))}
                className="border-input h-9 flex-1 rounded-md border bg-transparent px-2 text-sm"
              />
              <BarcodeScanButton onScan={(v) => setValues((prev) => ({ ...prev, screen_serial: v }))} />
            </div>
          </Field>
          <Field label="Mount type">
            <Select value={values.mount_type} options={MOUNT_TYPES} onChange={(v) => setValues((prev) => ({ ...prev, mount_type: v }))} />
          </Field>
          <Field label="Power source">
            <Select value={values.power_source} options={POWER_SOURCES} onChange={(v) => setValues((prev) => ({ ...prev, power_source: v }))} />
          </Field>
          <Field label="Network">
            <Select value={values.network_type} options={NETWORK_TYPES} onChange={(v) => setValues((prev) => ({ ...prev, network_type: v }))} />
          </Field>
          {showWifiSignalJobDetails(values) && (
            <Field label="WiFi signal">
              <Select value={values.wifi_signal} options={WIFI_SIGNALS} onChange={(v) => setValues((prev) => ({ ...prev, wifi_signal: v }))} />
            </Field>
          )}
          {showNetworkPortJobDetails(values) && (
            <Field label="Network port">
              <input
                value={values.network_port}
                onChange={(e) => setValues((v) => ({ ...v, network_port: e.target.value }))}
                className="border-input h-9 w-full rounded-md border bg-transparent px-2 text-sm"
              />
            </Field>
          )}
          <Field label="Player boot test">
            <Select value={values.player_boot_test} options={PASS_FAIL} onChange={(v) => setValues((prev) => ({ ...prev, player_boot_test: v }))} labelFor={humanize} />
          </Field>
          <Field label="Content displaying">
            <Select value={values.content_displaying} options={PASS_FAIL} onChange={(v) => setValues((prev) => ({ ...prev, content_displaying: v }))} labelFor={humanize} />
          </Field>
        </>
      )}

      <PhotoGrid jobId={jobId} slots={slots} currentUser={currentUser} mediaBySlot={mediaBySlot} onMutated={onMutated} />

      {showsIssuesSection(jobType) && (
        <>
          <Field label="Issues found?">
            <YesNoButtons
              value={values.issues_found}
              onChange={(v) => setValues((prev) => ({ ...prev, issues_found: v, issue_detail: v ? prev.issue_detail : "" }))}
            />
          </Field>
          {showIssueDetailJobDetails(values) && (
            <Field label="Issue detail">
              <Textarea value={values.issue_detail} onChange={(e) => setValues((v) => ({ ...v, issue_detail: e.target.value }))} />
            </Field>
          )}
        </>
      )}

      {showsRevisitRequired(jobType) && (
        <Field label="Revisit required">
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={values.revisit_required === "yes" ? "default" : "outline"}
              onClick={() => setValues((v) => ({ ...v, revisit_required: "yes" }))}
            >
              Yes
            </Button>
            <Button
              type="button"
              size="sm"
              variant={values.revisit_required === "no" ? "default" : "outline"}
              onClick={() => setValues((v) => ({ ...v, revisit_required: "no" }))}
            >
              No
            </Button>
          </div>
        </Field>
      )}

      <Field label="Engineer notes">
        <Textarea value={values.engineer_notes} onChange={(e) => setValues((v) => ({ ...v, engineer_notes: e.target.value }))} />
      </Field>

      <div>
        <p className="mb-2 text-sm font-medium">Customer sign off</p>
        <SignatureCapture jobId={jobId} capturedBy={currentUser.id} captured={!!signature} clientName={site?.contact_name ?? ""} onCaptured={onMutated} />
      </div>

      <SubmitSection errors={errors} isSubmitting={isSubmitting} onSubmit={onSubmit} />
    </div>
  );
}

function PhotoGrid({
  jobId,
  slots,
  currentUser,
  mediaBySlot,
  onMutated,
}: {
  jobId: string;
  slots: readonly string[];
  currentUser: CurrentUser;
  mediaBySlot: Map<string, MediaQueueItem[]>;
  onMutated?: () => void;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium">Photos</p>
      <div className="grid grid-cols-3 gap-3">
        {slots.map((slot) => (
          <PhotoSlot key={slot} jobId={jobId} slot={slot} label={humanize(slot.replace("photo_", ""))} capturedBy={currentUser.id} items={mediaBySlot.get(slot) ?? []} onCaptured={onMutated} />
        ))}
      </div>
    </div>
  );
}

function SubmitSection({ errors, isSubmitting, onSubmit }: { errors: string[]; isSubmitting: boolean; onSubmit: () => void }) {
  return (
    <>
      {errors.length > 0 && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <p className="font-medium">Can&apos;t submit yet:</p>
          <ul className="list-disc pl-5">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      <Button onClick={onSubmit} disabled={isSubmitting} size="lg">
        {isSubmitting ? "Submitting…" : "Check Out & Submit"}
      </Button>
    </>
  );
}

function YesNoButtons({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="flex gap-2">
      <Button type="button" size="sm" variant={value ? "default" : "outline"} onClick={() => onChange(true)}>
        Yes
      </Button>
      <Button type="button" size="sm" variant={!value ? "default" : "outline"} onClick={() => onChange(false)}>
        No
      </Button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

function Select({
  value,
  options,
  onChange,
  labelFor,
}: {
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  /** Most option lists (mount type, power source, ...) are already authored in the display casing they want; only pass this when the raw values are stored-format lowercase (e.g. PASS_FAIL). */
  labelFor?: (value: string) => string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
    >
      <option value="">Select…</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {labelFor ? labelFor(o) : o}
        </option>
      ))}
    </select>
  );
}
