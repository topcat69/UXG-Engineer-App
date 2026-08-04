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
};

const job = {
  id: "job-1",
  job_number: "OPOC-2026-0042",
  scheduled_start: "2026-08-10T09:00:00.000Z",
  scheduled_end: "2026-08-10T11:00:00.000Z",
  calendar_event_id: null,
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
    const payload = buildEventPayload(job, site, "https://opoc.example.com");
    expect(payload.summary).toBe("OPOC-2026-0042 — Riverside Retail Park");
  });

  it("sets location to the full postal address, not just the site name", () => {
    const payload = buildEventPayload(job, site, "https://opoc.example.com");
    expect(payload.location).toBe("12 River Road, Leeds, LS1 4AB");
  });

  it("includes access notes, site contact, and a deep link to the job in the description", () => {
    const payload = buildEventPayload(job, site, "https://opoc.example.com");
    expect(payload.description).toContain("Access notes: Use the loading bay, ask for Dave");
    expect(payload.description).toContain("Dave Holt (07700 900123)");
    expect(payload.description).toContain("https://opoc.example.com/office/jobs/job-1");
  });

  it("carries the job's scheduled start/end through unchanged", () => {
    const payload = buildEventPayload(job, site, "https://opoc.example.com");
    expect(payload.start).toEqual({ dateTime: "2026-08-10T09:00:00.000Z" });
    expect(payload.end).toEqual({ dateTime: "2026-08-10T11:00:00.000Z" });
  });

  it("throws if the job has no schedule yet, rather than building a bogus event", () => {
    expect(() => buildEventPayload({ ...job, scheduled_start: null }, site, "https://x")).toThrow();
  });

  it("omits missing optional description lines instead of leaving blank lines", () => {
    const payload = buildEventPayload(job, { ...site, access_notes: null, contact_name: null }, "https://x");
    expect(payload.description).toBe("https://x/office/jobs/job-1");
  });
});
