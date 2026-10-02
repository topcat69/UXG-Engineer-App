import { describe, expect, it } from "vitest";
import { errorMessage } from "./errors";

describe("errorMessage", () => {
  it("returns an Error's message", () => {
    expect(errorMessage(new Error("boom"))).toBe("boom");
  });

  it("returns a string as-is", () => {
    expect(errorMessage("already a string")).toBe("already a string");
  });

  it("pulls a string .message off a plain object, e.g. a non-Error API error payload", () => {
    expect(errorMessage({ message: "invalid_grant", code: 400 })).toBe("invalid_grant");
  });

  it("never produces the useless '[object Object]' String(error) gives for a plain object with no .message", () => {
    const result = errorMessage({ code: 404, status: "NOT_FOUND" });
    expect(result).not.toBe("[object Object]");
    expect(result).toContain("404");
  });

  it("falls back to String() for a value JSON.stringify can't handle", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(errorMessage(circular)).toBe(String(circular));
  });
});
