import { describe, expect, it } from "vitest";
import { parseUsersCsv } from "./parse-users";

describe("parseUsersCsv", () => {
  it("parses a valid row and defaults role to engineer", () => {
    const csv = "email,name\nAlice@Example.com,Alice";
    const { rows, errors } = parseUsersCsv(csv);
    expect(errors).toEqual([]);
    expect(rows).toEqual([{ email: "alice@example.com", name: "Alice", role: "engineer", company: undefined, phone: undefined, active: undefined, max_jobs_per_day: undefined }]);
  });

  it("accepts an explicit role", () => {
    const csv = "email,name,role\nbob@example.com,Bob,Manager";
    const { rows } = parseUsersCsv(csv);
    expect(rows[0].role).toBe("manager");
  });

  it("rejects an unrecognised role", () => {
    const csv = "email,name,role\nbob@example.com,Bob,superadmin";
    const { rows, errors } = parseUsersCsv(csv);
    expect(rows[0].role).toBe("engineer");
    expect(errors[0]).toMatch(/unrecognised role/);
  });

  it("rejects a duplicate email within the same file", () => {
    const csv = "email,name\na@example.com,A\na@example.com,A Duplicate";
    const { rows, errors } = parseUsersCsv(csv);
    expect(rows).toHaveLength(1);
    expect(errors).toEqual(['Row 3: duplicate email "a@example.com" in this file']);
  });

  it("rejects a row missing email or name", () => {
    const csv = "email,name\n,\n,Name Only\nemail-only@example.com,";
    const { rows, errors } = parseUsersCsv(csv);
    expect(rows).toEqual([]);
    expect(errors).toHaveLength(3);
  });
});
