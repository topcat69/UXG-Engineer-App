import { humanize } from "@/lib/format/text";
import type { Database } from "@/lib/supabase/database.types";

type SurveyForm = Database["public"]["Tables"]["survey_forms"]["Row"];
type SurveyScreen = Database["public"]["Tables"]["survey_screens"]["Row"];
type SurveyAction = Database["public"]["Tables"]["survey_actions"]["Row"];

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value === null || value === undefined || value === "" ? "—" : value}</dd>
    </div>
  );
}

function yesNo(value: boolean | null): string {
  if (value === null) return "—";
  return value ? "Yes" : "No";
}

/**
 * The office review side of the Site Survey Form (Phase 3 of the scoped
 * rework) — replaces the old single-row survey_forms read-out with the
 * real per-screen breakdown, a Fleet/Asset Capture table derived from the
 * screens' own make/model/serial/MAC fields (never entered separately —
 * see the migration's own comment on survey_screens), and the Actions &
 * Follow-up list. Read-only: all editing happens in the field app.
 */
export function SurveyFormPanel({
  survey,
  screens,
  actions,
}: {
  survey: SurveyForm;
  screens: SurveyScreen[];
  actions: SurveyAction[];
}) {
  const fleetRows = screens.filter((s) => s.display_make_model || s.player_make_model || s.serial_number || s.mac_address);

  return (
    <div className="flex flex-col gap-6">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
        <Field label="Project" value={survey.project} />
        <Field label="Surveyor" value={survey.surveyor} />
        <Field label="Survey date" value={survey.survey_date} />
        <Field label="Site contact" value={survey.site_contact_name} />
        <Field label="Contact role" value={survey.site_contact_role} />
        <Field label="Contact phone" value={survey.site_contact_phone} />
        <Field label="Screens surveyed" value={screens.length} />
      </dl>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Access &amp; logistics</h3>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
          <Field label="Access notes" value={survey.access_notes} />
          <Field label="Delivery notes" value={survey.delivery_notes} />
          <Field label="Working hours" value={survey.working_hours} />
          <Field label="Site induction required" value={yesNo(survey.site_induction_required)} />
          <Field label="PPE required" value={survey.ppe_required} />
          <Field label="Escort required" value={yesNo(survey.escort_required)} />
        </dl>
      </section>

      {screens.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-medium">Screens</h3>
          <div className="flex flex-col gap-3">
            {screens.map((screen, i) => (
              <div key={screen.id} className="rounded-md border p-3">
                <p className="mb-2 font-medium">{screen.screen_label || `Screen ${i + 1}`}</p>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
                  <Field label="Location" value={screen.location} />
                  <Field label="Environment" value={screen.environment ? humanize(screen.environment) : null} />
                  <Field label="Mounting height" value={screen.mounting_height} />
                  <Field label="Screen size" value={screen.screen_size} />
                  <Field label="Orientation" value={screen.orientation ? humanize(screen.orientation) : null} />
                  <Field label="Brightness tier" value={screen.brightness_tier} />
                  <Field label="Mount surface" value={screen.mount_surface} />
                  <Field label="Fixing type" value={screen.fixing_type} />
                  <Field label="Estimated weight (kg)" value={screen.estimated_weight} />
                  <Field label="Socket count" value={screen.socket_count} />
                  <Field label="Distance to socket" value={screen.distance_to_socket} />
                  <Field label="Connection method" value={screen.connection_method ? humanize(screen.connection_method) : null} />
                  <Field label="WiFi SSID" value={screen.wifi_ssid} />
                  <Field label="IP mode" value={screen.ip_mode ? humanize(screen.ip_mode) : null} />
                  <Field label="VLAN" value={screen.vlan} />
                </dl>
              </div>
            ))}
          </div>
        </section>
      )}

      {fleetRows.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Fleet / asset capture</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-1.5 pr-4 font-medium">Screen</th>
                  <th className="py-1.5 pr-4 font-medium">Display make/model</th>
                  <th className="py-1.5 pr-4 font-medium">Player make/model</th>
                  <th className="py-1.5 pr-4 font-medium">Serial no.</th>
                  <th className="py-1.5 font-medium">MAC address</th>
                </tr>
              </thead>
              <tbody>
                {fleetRows.map((screen, i) => (
                  <tr key={screen.id} className="border-b">
                    <td className="py-1.5 pr-4">{screen.screen_label || `Screen ${i + 1}`}</td>
                    <td className="py-1.5 pr-4">{screen.display_make_model || "—"}</td>
                    <td className="py-1.5 pr-4">{screen.player_make_model || "—"}</td>
                    <td className="py-1.5 pr-4">{screen.serial_number || "—"}</td>
                    <td className="py-1.5">{screen.mac_address || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Network, cabling &amp; environment</h3>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
          <Field label="IT contact" value={survey.it_contact_name} />
          <Field label="Network summary" value={survey.network_summary_notes} />
          <Field label="Cable route notes" value={survey.cable_route_notes} />
          <Field label="Containment present" value={survey.containment_present} />
          <Field label="Floor boxes required" value={yesNo(survey.floor_boxes_required)} />
          <Field label="Ventilation adequate" value={yesNo(survey.ventilation_adequate)} />
          <Field label="Enclosure required" value={yesNo(survey.enclosure_required)} />
          <Field label="Direct sunlight" value={yesNo(survey.direct_sunlight)} />
        </dl>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Health, safety &amp; compliance</h3>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
          <Field label="Working at height" value={survey.working_at_height} />
          <Field label="Asbestos register checked" value={yesNo(survey.asbestos_checked)} />
          <Field label="RAMS required" value={yesNo(survey.rams_required)} />
          <Field label="DDA / accessibility compliant" value={yesNo(survey.dda_compliant)} />
          <Field label="Other trades" value={survey.other_trades_notes} />
          <Field label="Floor plan captured" value={yesNo(survey.floor_plan_captured)} />
          <Field label="Measurements checked" value={yesNo(survey.measurements_checked)} />
        </dl>
      </section>

      {actions.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Actions &amp; follow-up</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-1.5 pr-4 font-medium">Action</th>
                <th className="py-1.5 pr-4 font-medium">Owner</th>
                <th className="py-1.5 pr-4 font-medium">Due</th>
                <th className="py-1.5 font-medium">Done</th>
              </tr>
            </thead>
            <tbody>
              {actions.map((action) => (
                <tr key={action.id} className="border-b">
                  <td className="py-1.5 pr-4">{action.action}</td>
                  <td className="py-1.5 pr-4">{action.owner || "—"}</td>
                  <td className="py-1.5 pr-4">{action.due_date || "—"}</td>
                  <td className="py-1.5">{action.done ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {survey.outstanding_items && (
        <section className="flex flex-col gap-1">
          <h3 className="text-sm font-medium">Outstanding items</h3>
          <p className="text-sm whitespace-pre-wrap">{survey.outstanding_items}</p>
        </section>
      )}
    </div>
  );
}
