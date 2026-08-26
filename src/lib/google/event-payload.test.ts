import { describe, expect, it } from "vitest";
import { buildEventPayload, fullSiteAddress } from "./event-payload";

const site = {
  name: "Riverside Retail Park",
  address_line1: "12 River Road",
  address_line2: null,
  town: "Leeds",
  postcode: "LS1 4AB",
  access_notes: "Use the loading bay, ask for Dave",
  contact_name: "Dave Holt",
  contact_phone: "07700 900123",
  latitude: 53.7997,
  longitude: -1.5492,
};

const job = {
  id: "job-1",
  job_number: "UXG-2026-0042",
  scheduled_start: "2026-08-10T09:00:00.000Z",
  scheduled_end: "2026-08-10T11:00:00.000Z",
  calendar_event_id: null,
  description: "Replace faulty player and re-test content playback.",
  job_type: "install",
  status: "scheduled" as const,
  assignedName: "Sam Carter",
  jobInformation: "Site manager expects us before 9am, park round the back.",
  slaRequirementDetail: "4-hour response",
  equipment: [
    { model: "BrightSign XT1144", serial: "SN-1001" },
    { model: "Samsung QM75B", serial: null },
  ],
};

describe("fullSiteAddress", () => {
  it("joins the non-empty address parts with commas", () => {
    expect(fullSiteAddress(site)).toBe("12 River Road, Leeds, LS1 4AB");
  });

  it("skips missing parts rather than leaving empty commas", () => {
    expect(fullSiteAddress({ ...site, address_line1: null, town: null })).toBe("LS1 4AB");
  });
});

describe("buildEventPayload", () => {
  it("titles the event '{job_number} — {site.name}'", () => {
    const payload = buildEventPayload(job, site, "https://uxgengineering.example.com");
    expect(payload.summary).toBe("UXG-2026-0042 — Riverside Retail Park");
  });

  it("prefixes the title with 'PROVISIONAL —' in capitals when the job is provisional", () => {
    const payload = buildEventPayload({ ...job, status: "provisional" }, site, "https://uxgengineering.example.com");
    expect(payload.summary).toBe("PROVISIONAL — UXG-2026-0042 — Riverside Retail Park");
  });

  it("does not prefix the title for a plain scheduled job", () => {
    const payload = buildEventPayload(job, site, "https://uxgengineering.example.com");
    expect(payload.summary).not.toContain("PROVISIONAL");
  });

  it("sets location to the full postal address, not just the site name", () => {
    const payload = buildEventPayload(job, site, "https://uxgengineering.example.com");
    expect(payload.location).toBe("12 River Road, Leeds, LS1 4AB");
  });

  it("includes site, assignee, job type, description, job information, SLA, equipment, access notes, site contact, and a deep link", () => {
    const payload = buildEventPayload(job, site, "https://uxgengineering.example.com");
    expect(payload.description).toContain("Site: Riverside Retail Park");
    expect(payload.description).toContain("Assigned to: Sam Carter");
    expect(payload.description).toContain("Job type: Installation");
    expect(payload.description).not.toContain("Priority:");
    expect(payload.description).toContain("Job description: Replace faulty player and re-test content playback.");
    expect(payload.description).toContain("Job information: Site manager expects us before 9am, park round the back.");
    expect(payload.description).toContain("SLA requirement: 4-hour response");
    expect(payload.description).toContain("Equipment: BrightSign XT1144 (SN-1001), Samsung QM75B");
    expect(payload.description).toContain("Access notes: Use the loading bay, ask for Dave");
    expect(payload.description).toContain("Dave Holt (07700 900123)");
    expect(payload.description).toContain("https://uxgengineering.example.com/office/jobs/job-1");
  });

  it("shows 'Unassigned' when the job has no assignee", () => {
    const payload = buildEventPayload({ ...job, assignedName: null }, site, "https://x");
    expect(payload.description).toContain("Assigned to: Unassigned");
  });

  it("omits the job description line when the job has none", () => {
    const payload = buildEventPayload({ ...job, description: null }, site, "https://x");
    expect(payload.description).not.toContain("Job description:");
  });

  it("is an all-day event: same-day job becomes start=that day, end=the next day (exclusive)", () => {
    const payload = buildEventPayload(job, site, "https://uxgengineering.example.com");
    expect(payload.start).toEqual({ date: "2026-08-10" });
    expect(payload.end).toEqual({ date: "2026-08-11" });
  });

  it("spans a multi-day job's full range, end date still exclusive", () => {
    const multiDayJob = { ...job, scheduled_start: "2026-08-10T09:00:00.000Z", scheduled_end: "2026-08-12T17:00:00.000Z" };
    const payload = buildEventPayload(multiDayJob, site, "https://x");
    expect(payload.start).toEqual({ date: "2026-08-10" });
    expect(payload.end).toEqual({ date: "2026-08-13" });
  });

  it("throws if the job has no schedule yet, rather than building a bogus event", () => {
    expect(() => buildEventPayload({ ...job, scheduled_start: null }, site, "https://x")).toThrow();
  });

  it("omits missing optional description lines instead of leaving blank lines", () => {
    const payload = buildEventPayload(
      { ...job, description: null, jobInformation: null, slaRequirementDetail: null, equipment: [], assignedName: null },
      { ...site, access_notes: null, contact_name: null, latitude: null, longitude: null },
      "https://x",
    );
    expect(payload.description).toBe(
      "Site: Riverside Retail Park\nAssigned to: Unassigned\nJob type: Installation\nhttps://x/office/jobs/job-1",
    );
  });

  it("includes a link to the site's exact stored coordinates when known", () => {
    const payload = buildEventPayload(job, site, "https://x");
    expect(payload.description).toContain("https://www.google.com/maps?q=53.7997,-1.5492");
  });

  it("omits the coordinates link when the site has no lat/lng on file", () => {
    const payload = buildEventPayload(job, { ...site, latitude: null, longitude: null }, "https://x");
    expect(payload.description).not.toContain("google.com/maps");
  });
});
