import { describe, expect, it } from "vitest";
import { parseSitesCsv } from "./sites";

describe("parseSitesCsv", () => {
  it("parses valid rows including optional columns", () => {
    const csv = `name,address_line1,town,postcode,latitude,longitude,organisation,contact_email
Site A,1 High St,Testford,TE1 1AA,51.5,-0.1,Acme,dave@acme.example
Site B,,,,,,,`;
    const { rows, errors } = parseSitesCsv(csv);
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      name: "Site A",
      address_line1: "1 High St",
      town: "Testford",
      postcode: "TE1 1AA",
      latitude: 51.5,
      longitude: -0.1,
      organisation: "Acme",
      contact_email: "dave@acme.example",
    });
    expect(rows[1]).toMatchObject({ name: "Site B" });
    expect(rows[1].latitude).toBeUndefined();
  });

  it("skips rows missing the required name column and reports why", () => {
    const csv = `name,town\n,Testford\nSite C,Testford`;
    const { rows, errors } = parseSitesCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Site C");
    expect(errors.some((e) => e.includes("missing required"))).toBe(true);
  });

  it("reports invalid latitude/longitude but keeps the row without them", () => {
    const csv = `name,latitude,longitude\nSite D,not-a-number,-0.1`;
    const { rows, errors } = parseSitesCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].latitude).toBeUndefined();
    expect(rows[0].longitude).toBe(-0.1);
    expect(errors.some((e) => e.includes("invalid latitude"))).toBe(true);
  });

  it("is case-insensitive and trims header whitespace", () => {
    const csv = ` Name , Town \nSite E,Testford`;
    const { rows, errors } = parseSitesCsv(csv);
    expect(errors).toHaveLength(0);
    expect(rows[0]).toMatchObject({ name: "Site E", town: "Testford" });
  });

  it("returns no rows for an empty CSV", () => {
    const { rows } = parseSitesCsv("name\n");
    expect(rows).toHaveLength(0);
  });
});
