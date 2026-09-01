import { describe, expect, it } from "vitest";
import { hasAnyFilter, parseJobListFilters } from "./list-query";

describe("parseJobListFilters", () => {
  it("defaults everything to empty/false when no params are present", () => {
    expect(parseJobListFilters({})).toEqual({
      status: "",
      jobType: "",
      projectId: "",
      assignedTo: "",
      clientId: "",
      siteId: "",
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

  it("parses client_id and site_id", () => {
    const filters = parseJobListFilters({ client_id: "client-1", site_id: "site-1" });
    expect(filters.clientId).toBe("client-1");
    expect(filters.siteId).toBe("site-1");
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
    expect(hasAnyFilter(parseJobListFilters({ client_id: "c1" }))).toBe(true);
    expect(hasAnyFilter(parseJobListFilters({ site_id: "s1" }))).toBe(true);
  });
});
