import { describe, expect, it } from "vitest";
import { isSignInAllowedUnderSso } from "./sso-policy";

describe("isSignInAllowedUnderSso", () => {
  it("always allows superadmin, regardless of amr", () => {
    expect(isSignInAllowedUnderSso("superadmin", false, [])).toBe(true);
    expect(isSignInAllowedUnderSso("superadmin", false, ["otp"])).toBe(true);
  });

  it("allows a non-superadmin OAuth session", () => {
    expect(isSignInAllowedUnderSso("engineer", false, ["oauth"])).toBe(true);
    expect(isSignInAllowedUnderSso("warehouse", false, [{ method: "oauth" }])).toBe(true);
  });

  it("blocks a non-superadmin magic-link/OTP session even with the amr entry present", () => {
    expect(isSignInAllowedUnderSso("engineer", false, ["otp"])).toBe(false);
    expect(isSignInAllowedUnderSso("manager", false, [{ method: "otp" }])).toBe(false);
  });

  it("blocks a password session when the account hasn't been opted in", () => {
    expect(isSignInAllowedUnderSso("warehouse", false, ["password"])).toBe(false);
  });

  it("allows a password session once the account is opted in", () => {
    expect(isSignInAllowedUnderSso("warehouse", true, ["password"])).toBe(true);
    expect(isSignInAllowedUnderSso("engineer", true, [{ method: "password" }])).toBe(true);
  });

  it("does not let allow_password_login substitute for an actual password session", () => {
    // Opted in, but this session was actually established via OTP — the flag
    // only ever widens what a *password*-authenticated session can do.
    expect(isSignInAllowedUnderSso("warehouse", true, ["otp"])).toBe(false);
  });

  it("blocks an empty amr for a non-superadmin account", () => {
    expect(isSignInAllowedUnderSso("manager", false, [])).toBe(false);
    expect(isSignInAllowedUnderSso("manager", true, [])).toBe(false);
  });
});
