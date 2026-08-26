import { describe, expect, it } from "vitest";
import { localInputValueToIso, toLocalInputValue } from "./datetime-local";

describe("toLocalInputValue", () => {
  it("returns an empty string for null", () => {
    expect(toLocalInputValue(null)).toBe("");
  });

  it("produces a value matching the datetime-local input format", () => {
    expect(toLocalInputValue("2026-09-05T09:00:00.000Z")).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });
});

describe("localInputValueToIso", () => {
  it("returns an empty string for an empty value", () => {
    expect(localInputValueToIso("")).toBe("");
  });

  it("returns an empty string for an unparseable value", () => {
    expect(localInputValueToIso("not-a-date")).toBe("");
  });

  it("produces a real UTC instant (Z-suffixed) for a valid datetime-local value", () => {
    const iso = localInputValueToIso("2026-09-05T10:00");
    expect(iso).toMatch(/Z$/);
    expect(Number.isNaN(new Date(iso).getTime())).toBe(false);
  });
});

describe("toLocalInputValue / localInputValueToIso round-trip", () => {
  it("recovers the exact same instant after going through a datetime-local input", () => {
    // Whatever timezone this test runs in, the two conversions are exact
    // inverses of each other, so the instant must survive the round trip —
    // this is the property that was broken by the real bug: a naive
    // datetime-local string sent across the Server Action boundary and
    // parsed in the *server's* timezone instead of the browser's, which
    // silently shifted the stored instant by the server/browser offset
    // (BST -> UTC turned a typed "10:00" into a stored "11:00").
    const original = "2026-09-05T09:37:00.000Z";
    const localValue = toLocalInputValue(original);
    const roundTripped = localInputValueToIso(localValue);
    expect(new Date(roundTripped).getTime()).toBe(new Date(original).getTime());
  });

  it("round-trips a value with zero minutes and midnight hour cleanly", () => {
    const original = "2026-01-01T00:00:00.000Z";
    expect(new Date(localInputValueToIso(toLocalInputValue(original))).getTime()).toBe(new Date(original).getTime());
  });
});
