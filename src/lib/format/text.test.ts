import { describe, expect, it } from "vitest";
import { humanize, titleCase } from "./text";

describe("humanize", () => {
  it("capitalizes a single lowercase word", () => {
    expect(humanize("draft")).toBe("Draft");
  });

  it("splits snake_case into title-cased words", () => {
    expect(humanize("in_progress")).toBe("In Progress");
    expect(humanize("on_hold")).toBe("On Hold");
    expect(humanize("under_review")).toBe("Under Review");
  });

  it("special-cases 'na' to 'N/A'", () => {
    expect(humanize("na")).toBe("N/A");
    expect(humanize("NA")).toBe("N/A");
  });

  it("is idempotent on an already-capitalized value", () => {
    expect(humanize("Draft")).toBe("Draft");
  });

  it("handles an empty string", () => {
    expect(humanize("")).toBe("");
  });
});

describe("titleCase", () => {
  it("title-cases an ALL CAPS word", () => {
    expect(titleCase("ABERDEEN")).toBe("Aberdeen");
  });

  it("title-cases an already-lowercase phrase", () => {
    expect(titleCase("high street")).toBe("High Street");
  });

  it("capitalizes after hyphens and apostrophes", () => {
    expect(titleCase("STOKE-ON-TRENT")).toBe("Stoke-On-Trent");
    expect(titleCase("O'BRIEN")).toBe("O'Brien");
  });

  it("is idempotent on an already-title-cased value", () => {
    expect(titleCase("Aberdeen")).toBe("Aberdeen");
  });

  it("handles an empty string", () => {
    expect(titleCase("")).toBe("");
  });
});
