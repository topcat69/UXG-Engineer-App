import { describe, expect, it } from "vitest";
import { parseMediaManifestCsv } from "./parse-media-manifest";

describe("parseMediaManifestCsv", () => {
  it("parses a valid row and infers media_type from the extension", () => {
    const csv = "job_number,slot,filename,latitude,longitude,captured_at,caption\nJOB-1,photo_before,JOB-1/before.jpg,52.1,-1.1,2023-02-05T09:00:00Z,Front entrance";
    const { rows, errors } = parseMediaManifestCsv(csv);
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({
      jobNumber: "JOB-1",
      slot: "photo_before",
      filename: "JOB-1/before.jpg",
      media_type: "image",
      latitude: 52.1,
      longitude: -1.1,
      caption: "Front entrance",
    });
  });

  it("infers video from a video extension", () => {
    const { rows } = parseMediaManifestCsv("job_number,slot,filename\nJOB-1,walkthrough,JOB-1/clip.mp4");
    expect(rows[0].media_type).toBe("video");
  });

  it("errors when media_type can't be inferred and isn't given explicitly", () => {
    const { rows, errors } = parseMediaManifestCsv("job_number,slot,filename\nJOB-1,doc,JOB-1/notes.txt");
    expect(rows).toEqual([]);
    expect(errors[0]).toMatch(/can't determine media_type/);
  });

  it("requires job_number, slot, and filename", () => {
    const { rows, errors } = parseMediaManifestCsv("job_number,slot,filename\n,,");
    expect(rows).toEqual([]);
    expect(errors).toEqual(['Row 2: missing required "job_number" column']);
  });
});
