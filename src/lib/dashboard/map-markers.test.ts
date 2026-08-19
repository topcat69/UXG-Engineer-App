import { describe, expect, it } from "vitest";
import { buildJobMapMarkers, categorizeJobStatus } from "./map-markers";

describe("categorizeJobStatus", () => {
  it("buckets travelling/on_site/in_progress as on_site", () => {
    expect(categorizeJobStatus("travelling")).toBe("on_site");
    expect(categorizeJobStatus("on_site")).toBe("on_site");
    expect(categorizeJobStatus("in_progress")).toBe("on_site");
  });

  it("buckets scheduled as scheduled", () => {
    expect(categorizeJobStatus("scheduled")).toBe("scheduled");
  });
});

describe("buildJobMapMarkers", () => {
  it("drops jobs whose site has no coordinates on file", () => {
    const markers = buildJobMapMarkers([
      { id: "1", job_number: "UXG-1", status: "scheduled", site: { name: "Site A", latitude: null, longitude: null }, assigned: null },
      { id: "2", job_number: "UXG-2", status: "scheduled", site: null, assigned: null },
      { id: "3", job_number: "UXG-3", status: "scheduled", site: { name: "Site C", latitude: 53.1, longitude: -0.5 }, assigned: null },
    ]);
    expect(markers).toHaveLength(1);
    expect(markers[0]!.id).toBe("3");
  });

  it("drops jobs whose status isn't scheduled or actively being worked", () => {
    const site = { name: "Site A", latitude: 53.1, longitude: -0.5 };
    const markers = buildJobMapMarkers([
      { id: "1", job_number: "UXG-1", status: "dispatched", site, assigned: null },
      { id: "2", job_number: "UXG-2", status: "accepted", site, assigned: null },
      { id: "3", job_number: "UXG-3", status: "on_hold", site, assigned: null },
      { id: "4", job_number: "UXG-4", status: "submitted", site, assigned: null },
      { id: "5", job_number: "UXG-5", status: "under_review", site, assigned: null },
      { id: "6", job_number: "UXG-6", status: "approved", site, assigned: null },
      { id: "7", job_number: "UXG-7", status: "closed", site, assigned: null },
      { id: "8", job_number: "UXG-8", status: "cancelled", site, assigned: null },
    ]);
    expect(markers).toHaveLength(0);
  });

  it("keeps scheduled and travelling/on_site/in_progress jobs", () => {
    const site = { name: "Site A", latitude: 53.1, longitude: -0.5 };
    const markers = buildJobMapMarkers([
      { id: "1", job_number: "UXG-1", status: "scheduled", site, assigned: null },
      { id: "2", job_number: "UXG-2", status: "travelling", site, assigned: null },
      { id: "3", job_number: "UXG-3", status: "on_site", site, assigned: null },
      { id: "4", job_number: "UXG-4", status: "in_progress", site, assigned: null },
    ]);
    expect(markers).toHaveLength(4);
  });

  it("maps every field through, including the derived category", () => {
    const markers = buildJobMapMarkers([
      {
        id: "1",
        job_number: "UXG-2026-0001",
        status: "in_progress",
        site: { name: "Tims Kitchen", latitude: 53.2, longitude: -0.4 },
        assigned: { name: "Engineer Test" },
      },
    ]);
    expect(markers).toEqual([
      {
        id: "1",
        jobNumber: "UXG-2026-0001",
        siteName: "Tims Kitchen",
        status: "in_progress",
        assignedName: "Engineer Test",
        latitude: 53.2,
        longitude: -0.4,
        category: "on_site",
      },
    ]);
  });
});
