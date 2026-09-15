"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { CurrentUser } from "@/lib/auth/current-user";
import { deleteSurveyAction, deleteSurveyScreen, upsertSurveyAction, upsertSurveyScreen } from "@/lib/offline/field-actions";
import { generateId } from "@/lib/offline/id";
import type { MediaQueueItem, SurveyActionRow, SurveyScreenRow } from "@/lib/offline/db";
import {
  BRIGHTNESS_TIER_OPTIONS,
  CONNECTION_METHOD_OPTIONS,
  ENVIRONMENT_OPTIONS,
  emptySurveyAction,
  emptySurveyScreen,
  IP_MODE_OPTIONS,
  ORIENTATION_OPTIONS,
  screenPhotoSlots,
  SURVEY_LEVEL_PHOTO_SLOTS,
  WIFI_SECURITY_OPTIONS,
  type SurveyFormValues,
} from "@/lib/forms/survey-form";
import { humanize } from "@/lib/format/text";
import { PhotoSlot } from "./photo-slot";

/**
 * The Site Survey Form's field-app capture flow (Phase 2 of the scoped
 * rework — see the survey-form-scope.html design note) — replaces the
 * borrowed Install form that used to render here. Screens/actions save
 * immediately on each change rather than through the header's 15s-batched
 * autosave (see upsertSurveyScreen's own doc comment for why); the header
 * fields stay on the same batched-values pattern JobWorkflow already uses
 * for job_details, via the `values`/`setValues` props.
 */
export function SurveyFormSection({
  jobId,
  currentUser,
  values,
  setValues,
  surveyFormId,
  screens,
  actions,
  tasks,
  onToggleTask,
  mediaBySlot,
  errors,
  isSubmitting,
  onSubmit,
}: {
  jobId: string;
  currentUser: CurrentUser;
  values: SurveyFormValues;
  setValues: React.Dispatch<React.SetStateAction<SurveyFormValues>>;
  surveyFormId: string;
  screens: SurveyScreenRow[];
  actions: SurveyActionRow[];
  tasks: { id: string; label: string; is_done: boolean }[];
  onToggleTask: (taskId: string, isDone: boolean) => void;
  mediaBySlot: Map<string, MediaQueueItem[]>;
  errors: string[];
  isSubmitting: boolean;
  onSubmit: () => void;
}) {
  return (
    <div className="flex flex-col gap-5">
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

      <div>
        <p className="mb-2 text-sm font-medium">Survey details</p>
        <div className="flex flex-col gap-3">
          <Field label="Project">
            <TextInput value={values.project} onChange={(v) => setValues((p) => ({ ...p, project: v }))} />
          </Field>
          <Field label="Surveyor">
            <TextInput value={values.surveyor} onChange={(v) => setValues((p) => ({ ...p, surveyor: v }))} />
          </Field>
          <Field label="Survey date">
            <input
              type="date"
              value={values.survey_date}
              onChange={(e) => setValues((p) => ({ ...p, survey_date: e.target.value }))}
              className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
            />
          </Field>
          <Field label="Site contact name">
            <TextInput value={values.site_contact_name} onChange={(v) => setValues((p) => ({ ...p, site_contact_name: v }))} />
          </Field>
          <Field label="Site contact role">
            <TextInput value={values.site_contact_role} onChange={(v) => setValues((p) => ({ ...p, site_contact_role: v }))} />
          </Field>
          <Field label="Site contact phone">
            <TextInput value={values.site_contact_phone} onChange={(v) => setValues((p) => ({ ...p, site_contact_phone: v }))} />
          </Field>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Access &amp; logistics</p>
        <div className="flex flex-col gap-3">
          <Field label="Access notes (parking, drop-off, booking-in)">
            <Textarea value={values.access_notes} onChange={(e) => setValues((p) => ({ ...p, access_notes: e.target.value }))} rows={2} />
          </Field>
          <Field label="Working hours / out-of-hours needed">
            <TextInput value={values.working_hours} onChange={(v) => setValues((p) => ({ ...p, working_hours: v }))} />
          </Field>
          <Field label="PPE required">
            <TextInput value={values.ppe_required} onChange={(v) => setValues((p) => ({ ...p, ppe_required: v }))} />
          </Field>
          <Check label="Site induction / permit / sign-in required" checked={values.site_induction_required} onChange={(v) => setValues((p) => ({ ...p, site_induction_required: v }))} />
          <Check label="Escort or key-holder needed" checked={values.escort_required} onChange={(v) => setValues((p) => ({ ...p, escort_required: v }))} />
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center gap-3">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => upsertSurveyScreen(jobId, emptySurveyScreen(generateId(), surveyFormId, screens.length))}
          >
            Add screen
          </Button>
          <p className="text-sm font-medium">Screens ({screens.length})</p>
        </div>
        <div className="flex flex-col gap-3">
          {screens.map((screen, i) => (
            <ScreenCard key={screen.id} jobId={jobId} currentUser={currentUser} screen={screen} index={i} mediaBySlot={mediaBySlot} />
          ))}
          {screens.length === 0 && <p className="text-muted-foreground text-sm">No screens added yet.</p>}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Network &amp; cabling</p>
        <div className="flex flex-col gap-3">
          <Field label="IT / network contact">
            <TextInput value={values.it_contact_name} onChange={(v) => setValues((p) => ({ ...p, it_contact_name: v }))} />
          </Field>
          <Field label="Network summary">
            <Textarea value={values.network_summary_notes} onChange={(e) => setValues((p) => ({ ...p, network_summary_notes: e.target.value }))} rows={2} />
          </Field>
          <Field label="Cable route notes">
            <Textarea value={values.cable_route_notes} onChange={(e) => setValues((p) => ({ ...p, cable_route_notes: e.target.value }))} rows={2} />
          </Field>
          <Field label="Existing containment / trunking present">
            <TextInput value={values.containment_present} onChange={(v) => setValues((p) => ({ ...p, containment_present: v }))} />
          </Field>
          <Field label="Cable concealment expectations">
            <TextInput value={values.cable_concealment} onChange={(v) => setValues((p) => ({ ...p, cable_concealment: v }))} />
          </Field>
          <Field label="Fire barriers / firestopping considerations">
            <TextInput value={values.firestopping_notes} onChange={(v) => setValues((p) => ({ ...p, firestopping_notes: v }))} />
          </Field>
          <Check label="Floor boxes / poke-throughs / dado trunking required" checked={values.floor_boxes_required} onChange={(v) => setValues((p) => ({ ...p, floor_boxes_required: v }))} />
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Environmental</p>
        <div className="flex flex-col gap-2">
          <Check label="Ventilation / heat dissipation adequate" checked={values.ventilation_adequate} onChange={(v) => setValues((p) => ({ ...p, ventilation_adequate: v }))} />
          <Check label="Enclosure required (dust / tamper / weather)" checked={values.enclosure_required} onChange={(v) => setValues((p) => ({ ...p, enclosure_required: v }))} />
          <Check label="Direct sunlight / heat build-up at location" checked={values.direct_sunlight} onChange={(v) => setValues((p) => ({ ...p, direct_sunlight: v }))} />
          <Check label="Temperature &amp; humidity acceptable" checked={values.temp_humidity_ok} onChange={(v) => setValues((p) => ({ ...p, temp_humidity_ok: v }))} />
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Health, safety &amp; survey record</p>
        <div className="flex flex-col gap-3">
          <Field label="Working at height — access equipment required">
            <TextInput value={values.working_at_height} onChange={(v) => setValues((p) => ({ ...p, working_at_height: v }))} />
          </Field>
          <Check label="Asbestos register checked (pre-2000 buildings)" checked={values.asbestos_checked} onChange={(v) => setValues((p) => ({ ...p, asbestos_checked: v }))} />
          <Check label="RAMS required" checked={values.rams_required} onChange={(v) => setValues((p) => ({ ...p, rams_required: v }))} />
          <Check label="Accessibility / DDA compliant" checked={values.dda_compliant} onChange={(v) => setValues((p) => ({ ...p, dda_compliant: v }))} />
          <Field label="Other trades / coordination required">
            <TextInput value={values.other_trades_notes} onChange={(v) => setValues((p) => ({ ...p, other_trades_notes: v }))} />
          </Field>
          <Check label="Floor plan / sketch with measurements captured" checked={values.floor_plan_captured} onChange={(v) => setValues((p) => ({ ...p, floor_plan_captured: v }))} />
          <Check label="Measurements double-checked" checked={values.measurements_checked} onChange={(v) => setValues((p) => ({ ...p, measurements_checked: v }))} />
          <div className="flex flex-col gap-2 sm:flex-row">
            {SURVEY_LEVEL_PHOTO_SLOTS.map((slot) => (
              <PhotoSlot
                key={slot}
                jobId={jobId}
                slot={slot}
                label={humanize(slot.replace("photo_", ""))}
                capturedBy={currentUser.id}
                items={mediaBySlot.get(slot) ?? []}
              />
            ))}
          </div>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center gap-3">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => upsertSurveyAction(jobId, emptySurveyAction(generateId(), surveyFormId, actions.length))}
          >
            Add action
          </Button>
          <p className="text-sm font-medium">Actions &amp; follow-up ({actions.length})</p>
        </div>
        <div className="flex flex-col gap-2">
          {actions.map((action) => (
            <ActionRow key={action.id} jobId={jobId} action={action} />
          ))}
          {actions.length === 0 && <p className="text-muted-foreground text-sm">No follow-up actions logged.</p>}
        </div>
      </div>

      <Field label="Outstanding items / risks">
        <Textarea value={values.outstanding_items} onChange={(e) => setValues((p) => ({ ...p, outstanding_items: e.target.value }))} rows={3} />
      </Field>
      <Field label="Engineer notes">
        <Textarea value={values.engineer_notes} onChange={(e) => setValues((p) => ({ ...p, engineer_notes: e.target.value }))} rows={2} />
      </Field>

      {errors.length > 0 && (
        <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3">
          <ul className="list-disc pl-5 text-sm text-destructive">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      <Button onClick={onSubmit} disabled={isSubmitting}>
        {isSubmitting ? "Submitting…" : "Check Out & Submit"}
      </Button>
    </div>
  );
}

function ScreenCard({
  jobId,
  currentUser,
  screen,
  index,
  mediaBySlot,
}: {
  jobId: string;
  currentUser: CurrentUser;
  screen: SurveyScreenRow;
  index: number;
  mediaBySlot: Map<string, MediaQueueItem[]>;
}) {
  function set<K extends keyof SurveyScreenRow>(key: K, value: SurveyScreenRow[K]) {
    upsertSurveyScreen(jobId, { ...screen, [key]: value });
  }

  function handleRemove() {
    if (!window.confirm("Remove this screen? Anything recorded for it will be lost.")) return;
    deleteSurveyScreen(jobId, screen.id);
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <TextInput
          value={screen.screen_label ?? ""}
          onChange={(v) => set("screen_label", v || null)}
          placeholder={`Screen ${index + 1}`}
        />
        <Button type="button" size="sm" variant="ghost" onClick={handleRemove}>
          Remove
        </Button>
      </div>

      <Field label="Location">
        <TextInput value={screen.location ?? ""} onChange={(v) => set("location", v || null)} />
      </Field>
      <Field label="Environment">
        <SelectInput
          value={screen.environment ?? ""}
          options={ENVIRONMENT_OPTIONS}
          labelFor={humanize}
          onChange={(v) => set("environment", v || null)}
        />
      </Field>
      <Field label="Mounting height / eyeline">
        <TextInput value={screen.mounting_height ?? ""} onChange={(v) => set("mounting_height", v || null)} />
      </Field>
      <Check label="Photo of location taken" checked={!!screen.photo_taken} onChange={(v) => set("photo_taken", v)} />
      <Check label="Position agreed with site contact" checked={!!screen.position_agreed} onChange={(v) => set("position_agreed", v)} />

      <Field label="Screen size &amp; quantity">
        <TextInput value={screen.screen_size ?? ""} onChange={(v) => set("screen_size", v || null)} />
      </Field>
      <Field label="Orientation">
        <SelectInput value={screen.orientation ?? ""} options={ORIENTATION_OPTIONS} labelFor={humanize} onChange={(v) => set("orientation", v || null)} />
      </Field>
      <Field label="Brightness tier">
        <SelectInput value={screen.brightness_tier ?? ""} options={BRIGHTNESS_TIER_OPTIONS} onChange={(v) => set("brightness_tier", v || null)} />
      </Field>
      <Check label="Commercial-grade panel required (24/7 or 16/7)" checked={!!screen.commercial_grade_required} onChange={(v) => set("commercial_grade_required", v)} />
      <Check label="Glare / reflection assessed" checked={!!screen.glare_assessed} onChange={(v) => set("glare_assessed", v)} />

      <Field label="Mount surface">
        <TextInput value={screen.mount_surface ?? ""} onChange={(v) => set("mount_surface", v || null)} />
      </Field>
      <Field label="Fixing type required">
        <TextInput value={screen.fixing_type ?? ""} onChange={(v) => set("fixing_type", v || null)} />
      </Field>
      <Field label="Estimated display + player weight (kg)">
        <input
          type="number"
          value={screen.estimated_weight ?? ""}
          onChange={(e) => set("estimated_weight", e.target.value === "" ? null : Number(e.target.value))}
          className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
        />
      </Field>
      <Check label="Overhead obstructions checked" checked={!!screen.overhead_obstructions} onChange={(v) => set("overhead_obstructions", v)} />
      <Check label="Anti-theft / tamper-proof fixings required" checked={!!screen.tamper_proof_required} onChange={(v) => set("tamper_proof_required", v)} />

      <Field label="Socket count at this location">
        <input
          type="number"
          value={screen.socket_count ?? ""}
          onChange={(e) => set("socket_count", e.target.value === "" ? null : Number(e.target.value))}
          className="border-input h-9 w-24 rounded-md border bg-transparent px-2 text-sm"
        />
      </Field>
      <Field label="Distance from screen to nearest socket">
        <TextInput value={screen.distance_to_socket ?? ""} onChange={(v) => set("distance_to_socket", v || null)} />
      </Field>
      <Check label="New power / fused spur required" checked={!!screen.new_spur_required} onChange={(v) => set("new_spur_required", v)} />
      <Check label="Switched with lighting / on a timer" checked={!!screen.switched_with_lighting} onChange={(v) => set("switched_with_lighting", v)} />

      <Field label="Connection method">
        <SelectInput value={screen.connection_method ?? ""} options={CONNECTION_METHOD_OPTIONS} labelFor={humanize} onChange={(v) => set("connection_method", v || null)} />
      </Field>
      <Check label="Live data point at this location" checked={!!screen.live_data_point} onChange={(v) => set("live_data_point", v)} />
      <Check label="WiFi signal strength checked" checked={!!screen.wifi_signal_checked} onChange={(v) => set("wifi_signal_checked", v)} />
      <Field label="WiFi SSID">
        <TextInput value={screen.wifi_ssid ?? ""} onChange={(v) => set("wifi_ssid", v || null)} />
      </Field>
      <Field label="WiFi security">
        <SelectInput value={screen.wifi_security ?? ""} options={WIFI_SECURITY_OPTIONS} onChange={(v) => set("wifi_security", v || null)} />
      </Field>
      <Field label="IP addressing">
        <SelectInput value={screen.ip_mode ?? ""} options={IP_MODE_OPTIONS} labelFor={humanize} onChange={(v) => set("ip_mode", v || null)} />
      </Field>
      <Field label="VLAN">
        <TextInput value={screen.vlan ?? ""} onChange={(v) => set("vlan", v || null)} />
      </Field>

      <p className="mt-1 text-sm font-medium">Fleet / asset capture</p>
      <Field label="Display make/model">
        <TextInput value={screen.display_make_model ?? ""} onChange={(v) => set("display_make_model", v || null)} />
      </Field>
      <Field label="Player make/model">
        <TextInput value={screen.player_make_model ?? ""} onChange={(v) => set("player_make_model", v || null)} />
      </Field>
      <Field label="Serial no.">
        <TextInput value={screen.serial_number ?? ""} onChange={(v) => set("serial_number", v || null)} />
      </Field>
      <Field label="MAC address">
        <TextInput value={screen.mac_address ?? ""} onChange={(v) => set("mac_address", v || null)} />
      </Field>

      <div className="flex flex-col gap-2 sm:flex-row">
        {screenPhotoSlots(screen.id).map(({ key, slot, label }) => (
          <PhotoSlot key={key} jobId={jobId} slot={slot} label={label} capturedBy={currentUser.id} items={mediaBySlot.get(slot) ?? []} />
        ))}
      </div>
    </div>
  );
}

function ActionRow({ jobId, action }: { jobId: string; action: SurveyActionRow }) {
  function handleRemove() {
    deleteSurveyAction(jobId, action.id);
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border p-2 sm:flex-row sm:items-end">
      <Field label="Action">
        <TextInput value={action.action} onChange={(v) => upsertSurveyAction(jobId, { ...action, action: v })} />
      </Field>
      <Field label="Owner">
        <TextInput value={action.owner ?? ""} onChange={(v) => upsertSurveyAction(jobId, { ...action, owner: v || null })} />
      </Field>
      <Field label="Due">
        <input
          type="date"
          value={action.due_date ?? ""}
          onChange={(e) => upsertSurveyAction(jobId, { ...action, due_date: e.target.value || null })}
          className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
        />
      </Field>
      <Check label="Done" checked={!!action.done} onChange={(v) => upsertSurveyAction(jobId, { ...action, done: v })} />
      <Button type="button" size="sm" variant="ghost" onClick={handleRemove}>
        Remove
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

function TextInput({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
    />
  );
}

function SelectInput({
  value,
  options,
  onChange,
  labelFor,
}: {
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  labelFor?: (value: string) => string;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="border-input h-9 rounded-md border bg-transparent px-2 text-sm">
      <option value="">Select…</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {labelFor ? labelFor(o) : o}
        </option>
      ))}
    </select>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" />
      {label}
    </label>
  );
}
