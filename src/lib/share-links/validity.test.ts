import { describe, expect, it } from "vitest";
import { isShareLinkValid } from "./validity";

const now = "2026-08-10T12:00:00.000Z";

describe("isShareLinkValid", () => {
  it("is valid when not revoked and not yet expired", () => {
    expect(isShareLinkValid({ revoked: false, expires_at: "2026-08-11T00:00:00.000Z" }, now)).toBe(true);
  });

  it("is invalid once revoked, regardless of expiry", () => {
    expect(isShareLinkValid({ revoked: true, expires_at: "2026-08-20T00:00:00.000Z" }, now)).toBe(false);
  });

  it("is invalid once past its expiry", () => {
    expect(isShareLinkValid({ revoked: false, expires_at: "2026-08-01T00:00:00.000Z" }, now)).toBe(false);
  });

  it("treats a null revoked flag as not revoked", () => {
    expect(isShareLinkValid({ revoked: null, expires_at: "2026-08-11T00:00:00.000Z" }, now)).toBe(true);
  });

  it("is invalid at the exact expiry instant", () => {
    expect(isShareLinkValid({ revoked: false, expires_at: now }, now)).toBe(false);
  });
});
