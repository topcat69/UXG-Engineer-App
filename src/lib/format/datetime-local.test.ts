import { describe, expect, it } from "vitest";
import { localDateInputValueToIso, localInputValueToIso, toLocalDateInputValue, toLocalInputValue } from "./datetime-local";

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

describe("toLocalDateInputValue", () => {
  it("returns an empty string for null", () => {
    expect(toLocalDateInputValue(null)).toBe("");
  });

  it("produces a value matching the date input format, with no time component", () => {
    expect(toLocalDateInputValue("2026-09-05T09:00:00.000Z")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("localDateInputValueToIso", () => {
  it("returns an empty string for an empty value", () => {
    expect(localDateInputValueToIso("")).toBe("");
  });

  it("returns an empty string for an unparseable value", () => {
    expect(localDateInputValueToIso("not-a-date")).toBe("");
  });

  it("anchors the instant at 9am local by default", () => {
    const iso = localDateInputValueToIso("2026-09-05");
    const d = new Date(iso);
    expect(d.getHours()).toBe(9);
    expect(d.getMinutes()).toBe(0);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(8);
    expect(d.getDate()).toBe(5);
  });

  it("accepts a custom anchor hour", () => {
    const iso = localDateInputValueToIso("2026-09-05", 14);
    expect(new Date(iso).getHours()).toBe(14);
  });
});

describe("toLocalDateInputValue / localDateInputValueToIso round-trip", () => {
  it("recovers the same calendar day after going through a date input, regardless of the original time of day", () => {
    // Unlike the datetime-local pair, this one is deliberately lossy on
    // time of day — that's the whole point (the office picks a day, not a
    // time) — so the property under test is just "same day in, same day
    // out," not "same instant."
    const original = "2026-09-05T23:37:00.000Z";
    const localValue = toLocalDateInputValue(original);
    const roundTripped = localDateInputValueToIso(localValue);
    expect(toLocalDateInputValue(roundTripped)).toBe(localValue);
  });
});
