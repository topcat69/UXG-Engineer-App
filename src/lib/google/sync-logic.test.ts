import { describe, expect, it, vi } from "vitest";
import { deleteEvent, syncEvent, type CalendarClientLike } from "./sync-logic";

const site = {
  name: "Riverside Retail Park",
  address_line1: "12 River Road",
  address_line2: null,
  town: "Leeds",
  postcode: "LS1 4AB",
  access_notes: null,
  contact_name: null,
  contact_phone: null,
  latitude: null,
  longitude: null,
};

const scheduledJob = {
  id: "job-1",
  job_number: "UXG-2026-0042",
  scheduled_start: "2026-08-10T09:00:00.000Z",
  scheduled_end: "2026-08-10T11:00:00.000Z",
  calendar_event_id: null as string | null,
  description: null as string | null,
  job_type: "install",
  priority: "P3",
  assignedName: null as string | null,
  jobInformation: null as string | null,
  slaRequirementDetail: null as string | null,
  equipment: [] as { model: string; serial: string | null }[],
};

function fakeCalendar(): CalendarClientLike {
  return {
    events: {
      insert: vi.fn().mockResolvedValue({ data: { id: "new-event-id" } }),
      patch: vi.fn().mockResolvedValue({ data: { id: "existing-event-id" } }),
      delete: vi.fn().mockResolvedValue(undefined),
    },
  };
}

describe("syncEvent", () => {
  it("skips without calling the API when Calendar isn't configured (null client)", async () => {
    const result = await syncEvent(null, scheduledJob, site, "https://uxgengineering.example.com", "primary");
    expect(result).toEqual({ status: "skipped", eventId: null });
  });

  it("inserts (never patches) when calendar_event_id is null — a job scheduled for the first time", async () => {
    const calendar = fakeCalendar();
    const result = await syncEvent(calendar, scheduledJob, site, "https://uxgengineering.example.com", "primary");

    expect(calendar.events.insert).toHaveBeenCalledOnce();
    expect(calendar.events.patch).not.toHaveBeenCalled();
    expect(result).toEqual({ status: "created", eventId: "new-event-id" });
  });

  it("patches the existing event (never inserts a second one) when calendar_event_id is already set — the reschedule case", async () => {
    const calendar = fakeCalendar();
    const alreadyScheduled = { ...scheduledJob, calendar_event_id: "existing-event-id" };
    const result = await syncEvent(calendar, alreadyScheduled, site, "https://uxgengineering.example.com", "primary");

    expect(calendar.events.patch).toHaveBeenCalledOnce();
    expect(calendar.events.patch).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: "existing-event-id", calendarId: "primary" }),
    );
    expect(calendar.events.insert).not.toHaveBeenCalled();
    expect(result).toEqual({ status: "updated", eventId: "existing-event-id" });
  });

  it("passes the built event payload (title/location) through to whichever API call it makes", async () => {
    const calendar = fakeCalendar();
    await syncEvent(calendar, scheduledJob, site, "https://uxgengineering.example.com", "primary");

    expect(calendar.events.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: expect.objectContaining({
          summary: "UXG-2026-0042 — Riverside Retail Park",
          location: "12 River Road, Leeds, LS1 4AB",
        }),
      }),
    );
  });
});

describe("deleteEvent", () => {
  it("skips without calling the API when Calendar isn't configured", async () => {
    const result = await deleteEvent(null, "some-event-id", "primary");
    expect(result).toEqual({ status: "skipped", eventId: "some-event-id" });
  });

  it("deletes the event and returns a null eventId, per the on-cancel spec", async () => {
    const calendar = fakeCalendar();
    const result = await deleteEvent(calendar, "some-event-id", "primary");

    expect(calendar.events.delete).toHaveBeenCalledWith({ calendarId: "primary", eventId: "some-event-id" });
    expect(result).toEqual({ status: "deleted", eventId: null });
  });

  it("treats an already-gone event (404) as success, not a failure to surface", async () => {
    const calendar = fakeCalendar();
    calendar.events.delete = vi.fn().mockRejectedValue({ response: { status: 404 } });

    const result = await deleteEvent(calendar, "some-event-id", "primary");
    expect(result).toEqual({ status: "deleted", eventId: null });
  });

  it("still throws for a genuine failure (not 404/410)", async () => {
    const calendar = fakeCalendar();
    calendar.events.delete = vi.fn().mockRejectedValue({ response: { status: 500 } });

    await expect(deleteEvent(calendar, "some-event-id", "primary")).rejects.toBeTruthy();
  });
});
