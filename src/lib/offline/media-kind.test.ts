import { describe, expect, it } from "vitest";
import { extensionForMime, mediaKindForFile, MAX_VIDEO_BYTES } from "./media-kind";

describe("mediaKindForFile", () => {
  it("treats any video/* mime as a video", () => {
    expect(mediaKindForFile(new Blob([], { type: "video/mp4" }))).toBe("video");
    expect(mediaKindForFile(new Blob([], { type: "video/quicktime" }))).toBe("video");
  });

  it("treats image/* and unknown mimes as a photo", () => {
    expect(mediaKindForFile(new Blob([], { type: "image/jpeg" }))).toBe("photo");
    expect(mediaKindForFile(new Blob([], { type: "" }))).toBe("photo");
  });
});

describe("extensionForMime", () => {
  it("maps video/quicktime to .mov rather than the literal subtype", () => {
    expect(extensionForMime("video/quicktime")).toBe("mov");
  });

  it("uses the mime subtype as the extension for other video types", () => {
    expect(extensionForMime("video/mp4")).toBe("mp4");
    expect(extensionForMime("video/webm")).toBe("webm");
  });

  it("falls back to mp4 for a malformed mime with no subtype", () => {
    expect(extensionForMime("video/")).toBe("mp4");
  });
});

describe("MAX_VIDEO_BYTES", () => {
  it("is a sane, positive cap", () => {
    expect(MAX_VIDEO_BYTES).toBeGreaterThan(0);
  });
});
