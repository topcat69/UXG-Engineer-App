import { describe, expect, it } from "vitest";
import { hasAnyFilter, parseJobListFilters } from "./list-query";

describe("parseJobListFilters", () => {
  it("defaults everything to empty/false when no params are present", () => {
    expect(parseJobListFilters({})).toEqual({
      status: "",
      jobType: "",
      projectId: "",
      assignedTo: "",
      q: "",
      ids: [],
      active: false,
      isRevisit: false,
    });
  });

  it("parses a comma-separated ids param into an array", () => {
    expect(parseJobListFilters({ ids: "a,b,c" }).ids).toEqual(["a", "b", "c"]);
  });

  it("drops empty segments from a trailing comma", () => {
    expect(parseJobListFilters({ ids: "a,b," }).ids).toEqual(["a", "b"]);
  });

  it("only treats the literal string 'true' as active/is_revisit", () => {
    expect(parseJobListFilters({ active: "true" }).active).toBe(true);
    expect(parseJobListFilters({ active: "yes" }).active).toBe(false);
    expect(parseJobListFilters({ is_revisit: "true" }).isRevisit).toBe(true);
  });

  it("takes the first value when a param repeats", () => {
    expect(parseJobListFilters({ status: ["scheduled", "closed"] }).status).toBe("scheduled");
  });
});

describe("hasAnyFilter", () => {
  it("is false for an all-default filter set", () => {
    expect(hasAnyFilter(parseJobListFilters({}))).toBe(false);
  });

  it("is true when any single filter is set", () => {
    expect(hasAnyFilter(parseJobListFilters({ q: "OPOC" }))).toBe(true);
    expect(hasAnyFilter(parseJobListFilters({ active: "true" }))).toBe(true);
    expect(hasAnyFilter(parseJobListFilters({ ids: "a" }))).toBe(true);
  });
});
