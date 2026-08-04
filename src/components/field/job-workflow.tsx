"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { CurrentUser } from "@/lib/auth/current-user";
import { db, type InstallFormRow } from "@/lib/offline/db";
import { checkIn, saveInstallFormDraft, submitJob } from "@/lib/offline/field-actions";
import { getCurrentPosition } from "@/lib/offline/media-capture";
import { distanceMeters } from "@/lib/geo/distance";
import {
  EMPTY_INSTALL_FORM,
  MOUNT_TYPES,
  NETWORK_TYPES,
  PASS_FAIL,
  PHOTO_SLOTS,
  POWER_SOURCES,
  WIFI_SIGNALS,
  installFormRowToValues,
  showIssueDetail,
  showWifiSignal,
  validateInstallForm,
  type InstallFormValues,
} from "@/lib/forms/install-form";
import { BarcodeScanButton } from "./barcode-scan-button";
import { PhotoSlot } from "./photo-slot";
import { SignatureCapture } from "./signature-capture";

const AUTOSAVE_INTERVAL_MS = 15_000;
const NOT_YET_ON_SITE: readonly string[] = ["draft", "scheduled", "dispatched", "accepted", "travelling"];

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
  const formRow = useLiveQuery(() => db.installForms.where("job_id").equals(jobId).first(), [jobId]);
  const media = useLiveQuery(() => db.mediaQueue.where("jobId").equals(jobId).toArray(), [jobId], []);

  const [values, setValues] = useState<InstallFormValues>(EMPTY_INSTALL_FORM);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const hydrated = useRef(false);

  // Hydrate local edit state from Dexie once per job, not on every autosave echo.
  useEffect(() => {
    hydrated.current = false;
  }, [jobId]);
  useEffect(() => {
    if (!hydrated.current && formRow !== undefined) {
      setValues(installFormRowToValues(formRow));
      hydrated.current = true;
    }
  }, [formRow]);

  const mediaBySlot = new Map((media ?? []).filter((m) => m.kind === "photo").map((m) => [m.slot, m]));
  const signature = (media ?? []).find((m) => m.kind === "signature");

  function currentFormRow(): InstallFormRow {
    return {
      id: formRow?.id ?? crypto.randomUUID(),
      job_id: jobId,
      player_serial: values.player_serial || null,
      screen_serial: values.screen_serial || null,
      mount_type: values.mount_type || null,
      power_source: values.power_source || null,
      network_type: values.network_type || null,
      wifi_signal: values.wifi_signal || null,
      player_boot_test: (values.player_boot_test || null) as InstallFormRow["player_boot_test"],
      content_displaying: (values.content_displaying || null) as InstallFormRow["content_displaying"],
      issues_found: values.issues_found,
      issue_detail: values.issue_detail || null,
      engineer_notes: values.engineer_notes || null,
      client_name: values.client_name || null,
      submitted_at: formRow?.submitted_at ?? null,
      created_at: formRow?.created_at ?? new Date().toISOString(),
    };
  }

  // 15-second autosave, surviving force-quit: Dexie writes are durable
  // IndexedDB writes, so whatever made it into the last tick is safe even
  // if the tab is killed a moment later.
  useEffect(() => {
    if (!job || NOT_YET_ON_SITE.includes(job.status)) return;
    const interval = setInterval(() => {
      saveInstallFormDraft(currentFormRow());
    }, AUTOSAVE_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.status, values]);

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

  async function handleCheckIn() {
    setIsCheckingIn(true);
    try {
      const position = await getCurrentPosition();
      let geofenceVarianceM: number | null = null;
      if (position && site?.latitude != null && site?.longitude != null) {
        geofenceVarianceM = distanceMeters(
          position.coords.latitude,
          position.coords.longitude,
          site.latitude,
          site.longitude,
        );
      }
      await checkIn(
        jobId,
        geofenceVarianceM,
        position ? { latitude: position.coords.latitude, longitude: position.coords.longitude } : null,
      );
      onMutated?.();
    } finally {
      setIsCheckingIn(false);
    }
  }

  async function handleSubmit() {
    const capturedSlots = new Set(mediaBySlot.keys());
    const validationErrors = validateInstallForm(values, capturedSlots, !!signature);
    setErrors(validationErrors);
    if (validationErrors.length > 0) return;

    setIsSubmitting(true);
    try {
      await saveInstallFormDraft(currentFormRow());
      const position = await getCurrentPosition();
      await submitJob(
        jobId,
        currentFormRow(),
        position ? { latitude: position.coords.latitude, longitude: position.coords.longitude } : null,
        currentUser.id,
      );
      onMutated?.();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      <button type="button" onClick={onBack} className="text-muted-foreground text-sm underline">
        ← Back
      </button>

      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">{job.job_number}</h1>
          <Badge variant="secondary">{job.status}</Badge>
        </div>
        <p className="text-muted-foreground text-sm">{site?.name}</p>
        <p className="text-muted-foreground text-sm">
          {[site?.address_line1, site?.town, site?.postcode].filter(Boolean).join(", ")}
        </p>
      </div>

      {NOT_YET_ON_SITE.includes(job.status) && (
        <Button onClick={handleCheckIn} disabled={isCheckingIn}>
          {isCheckingIn ? "Checking in…" : "Check In & Start Work"}
        </Button>
      )}

      {(job.status === "on_site" || job.status === "in_progress") && (
        <div className="flex flex-col gap-4">
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
            <Select
              value={values.mount_type}
              options={MOUNT_TYPES}
              onChange={(v) => setValues((prev) => ({ ...prev, mount_type: v }))}
            />
          </Field>

          <Field label="Power source">
            <Select
              value={values.power_source}
              options={POWER_SOURCES}
              onChange={(v) => setValues((prev) => ({ ...prev, power_source: v }))}
            />
          </Field>

          <Field label="Network">
            <Select
              value={values.network_type}
              options={NETWORK_TYPES}
              onChange={(v) => setValues((prev) => ({ ...prev, network_type: v }))}
            />
          </Field>

          {showWifiSignal(values) && (
            <Field label="WiFi signal">
              <Select
                value={values.wifi_signal}
                options={WIFI_SIGNALS}
                onChange={(v) => setValues((prev) => ({ ...prev, wifi_signal: v }))}
              />
            </Field>
          )}

          <Field label="Player boot test">
            <Select
              value={values.player_boot_test}
              options={PASS_FAIL}
              onChange={(v) => setValues((prev) => ({ ...prev, player_boot_test: v }))}
            />
          </Field>

          <Field label="Content displaying">
            <Select
              value={values.content_displaying}
              options={PASS_FAIL}
              onChange={(v) => setValues((prev) => ({ ...prev, content_displaying: v }))}
            />
          </Field>

          <div>
            <p className="mb-2 text-sm font-medium">Photos</p>
            <div className="grid grid-cols-3 gap-3">
              {PHOTO_SLOTS.map((slot) => (
                <PhotoSlot
                  key={slot}
                  jobId={jobId}
                  slot={slot}
                  label={slot.replace("photo_", "").replace(/_/g, " ")}
                  capturedBy={currentUser.id}
                  item={mediaBySlot.get(slot)}
                  onCaptured={onMutated}
                />
              ))}
            </div>
          </div>

          <Field label="Issues found?">
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={values.issues_found ? "default" : "outline"}
                onClick={() => setValues((v) => ({ ...v, issues_found: true }))}
              >
                Yes
              </Button>
              <Button
                type="button"
                size="sm"
                variant={!values.issues_found ? "default" : "outline"}
                onClick={() => setValues((v) => ({ ...v, issues_found: false, issue_detail: "" }))}
              >
                No
              </Button>
            </div>
          </Field>

          {showIssueDetail(values) && (
            <Field label="Issue detail">
              <Textarea
                value={values.issue_detail}
                onChange={(e) => setValues((v) => ({ ...v, issue_detail: e.target.value }))}
              />
            </Field>
          )}

          <Field label="Engineer notes">
            <Textarea
              value={values.engineer_notes}
              onChange={(e) => setValues((v) => ({ ...v, engineer_notes: e.target.value }))}
            />
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
            <SignatureCapture
              jobId={jobId}
              capturedBy={currentUser.id}
              captured={!!signature}
              clientName={values.client_name}
              onCaptured={onMutated}
            />
          </div>

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

          <Button onClick={handleSubmit} disabled={isSubmitting} size="lg">
            {isSubmitting ? "Submitting…" : "Check Out & Submit"}
          </Button>
        </div>
      )}

      {!NOT_YET_ON_SITE.includes(job.status) && job.status !== "on_site" && job.status !== "in_progress" && (
        <p className="text-muted-foreground text-sm">
          This job is {job.status.replace("_", " ")}. No further action needed here.
        </p>
      )}
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
}: {
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
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
          {o}
        </option>
      ))}
    </select>
  );
}
