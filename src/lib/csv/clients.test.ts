import { describe, expect, it } from "vitest";
import { parseClientsCsv } from "./clients";

describe("parseClientsCsv", () => {
  it("parses valid rows including optional columns", () => {
    const csv = `name,contact_name,contact_email,contact_phone,notes
FootAsylum,Dave Jones,dave@footasylum.example,01234 567890,200 UK stores
Acme Retail,,,,`;
    const { rows, errors } = parseClientsCsv(csv);
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      name: "FootAsylum",
      contact_name: "Dave Jones",
      contact_email: "dave@footasylum.example",
      contact_phone: "01234 567890",
      notes: "200 UK stores",
    });
    expect(rows[1]).toMatchObject({ name: "Acme Retail" });
    expect(rows[1].contact_email).toBeUndefined();
  });

  it("skips rows missing the required name column and reports why", () => {
    const csv = `name,contact_name\n,Dave\nFootAsylum,Dave`;
    const { rows, errors } = parseClientsCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("FootAsylum");
    expect(errors.some((e) => e.includes("missing required"))).toBe(true);
  });

  it("is case-insensitive and trims header whitespace", () => {
    const csv = ` Name , Contact_Email \nFootAsylum,dave@footasylum.example`;
    const { rows, errors } = parseClientsCsv(csv);
    expect(errors).toHaveLength(0);
    expect(rows[0]).toMatchObject({ name: "FootAsylum", contact_email: "dave@footasylum.example" });
  });

  it("returns no rows for an empty CSV", () => {
    const { rows } = parseClientsCsv("name\n");
    expect(rows).toHaveLength(0);
  });
});
