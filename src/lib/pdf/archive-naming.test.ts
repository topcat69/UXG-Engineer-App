import { describe, expect, it } from "vitest";
import { extensionFor, sanitizeFilename } from "./archive-naming";

describe("sanitizeFilename", () => {
  it("leaves an already-safe name untouched", () => {
    expect(sanitizeFilename("UXG-2026-0001")).toBe("UXG-2026-0001");
  });

  it("collapses slashes, spaces, and other unsafe characters to a single underscore", () => {
    expect(sanitizeFilename("Jo Smith / Site Contact")).toBe("Jo_Smith_Site_Contact");
  });
});

describe("extensionFor", () => {
  it("derives the extension from the mime type when present", () => {
    expect(extensionFor("image/png", "image")).toBe("png");
    expect(extensionFor("video/quicktime", "video")).toBe("quicktime");
  });

  it("falls back to jpg for a photo with no mime type", () => {
    expect(extensionFor(null, "image")).toBe("jpg");
  });

  it("falls back to mp4 for a video with no mime type", () => {
    expect(extensionFor(null, "video")).toBe("mp4");
  });
});
