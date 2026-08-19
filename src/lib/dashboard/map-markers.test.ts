import { describe, expect, it } from "vitest";
import { buildJobMapMarkers, categorizeJob, categorizeJobStatus } from "./map-markers";

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

describe("categorizeJob", () => {
  it("delegates to categorizeJobStatus when not a revisit", () => {
    expect(categorizeJob("scheduled", false)).toBe("scheduled");
    expect(categorizeJob("on_site", false)).toBe("on_site");
  });

  it("overrides to revisit regardless of status, when it is one", () => {
    expect(categorizeJob("scheduled", true)).toBe("revisit");
    expect(categorizeJob("on_site", true)).toBe("revisit");
  });
});

describe("buildJobMapMarkers", () => {
  it("drops jobs whose site has no coordinates on file", () => {
    const markers = buildJobMapMarkers([
      { id: "1", job_number: "UXG-1", status: "scheduled", parent_job_id: null, site: { name: "Site A", latitude: null, longitude: null }, assigned: null },
      { id: "2", job_number: "UXG-2", status: "scheduled", parent_job_id: null, site: null, assigned: null },
      { id: "3", job_number: "UXG-3", status: "scheduled", parent_job_id: null, site: { name: "Site C", latitude: 53.1, longitude: -0.5 }, assigned: null },
    ]);
    expect(markers).toHaveLength(1);
    expect(markers[0]!.id).toBe("3");
  });

  it("drops jobs whose status isn't scheduled or actively being worked", () => {
    const site = { name: "Site A", latitude: 53.1, longitude: -0.5 };
    const markers = buildJobMapMarkers([
      { id: "1", job_number: "UXG-1", status: "dispatched", parent_job_id: null, site, assigned: null },
      { id: "2", job_number: "UXG-2", status: "accepted", parent_job_id: null, site, assigned: null },
      { id: "3", job_number: "UXG-3", status: "on_hold", parent_job_id: null, site, assigned: null },
      { id: "4", job_number: "UXG-4", status: "submitted", parent_job_id: null, site, assigned: null },
      { id: "5", job_number: "UXG-5", status: "under_review", parent_job_id: null, site, assigned: null },
      { id: "6", job_number: "UXG-6", status: "approved", parent_job_id: null, site, assigned: null },
      { id: "7", job_number: "UXG-7", status: "closed", parent_job_id: null, site, assigned: null },
      { id: "8", job_number: "UXG-8", status: "cancelled", parent_job_id: null, site, assigned: null },
    ]);
    expect(markers).toHaveLength(0);
  });

  it("keeps scheduled and travelling/on_site/in_progress jobs", () => {
    const site = { name: "Site A", latitude: 53.1, longitude: -0.5 };
    const markers = buildJobMapMarkers([
      { id: "1", job_number: "UXG-1", status: "scheduled", parent_job_id: null, site, assigned: null },
      { id: "2", job_number: "UXG-2", status: "travelling", parent_job_id: null, site, assigned: null },
      { id: "3", job_number: "UXG-3", status: "on_site", parent_job_id: null, site, assigned: null },
      { id: "4", job_number: "UXG-4", status: "in_progress", parent_job_id: null, site, assigned: null },
    ]);
    expect(markers).toHaveLength(4);
  });

  it("categorizes a revisit job as 'revisit' rather than its status bucket", () => {
    const site = { name: "Site A", latitude: 53.1, longitude: -0.5 };
    const markers = buildJobMapMarkers([
      { id: "1", job_number: "UXG-1", status: "scheduled", parent_job_id: "parent-1", site, assigned: null },
    ]);
    expect(markers[0]!.category).toBe("revisit");
  });

  it("maps every field through, including the derived category", () => {
    const markers = buildJobMapMarkers([
      {
        id: "1",
        job_number: "UXG-2026-0001",
        status: "in_progress",
        parent_job_id: null,
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
