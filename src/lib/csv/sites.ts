import Papa from "papaparse";
import type { Database } from "@/lib/supabase/database.types";

export type SiteInsert = Database["public"]["Tables"]["sites"]["Insert"];

export type ParsedSitesCsv = {
  rows: SiteInsert[];
  errors: string[];
};

/**
 * Pure CSV -> row parser, deliberately with no Supabase call in it, so it can
 * be unit tested directly. Required column: `name`. Everything else is
 * optional and passed through; `latitude`/`longitude` are validated as
 * numbers when present.
 */
export function parseSitesCsv(text: string): ParsedSitesCsv {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  const errors: string[] = parsed.errors.map((e) => `Row ${(e.row ?? 0) + 2}: ${e.message}`);
  const rows: SiteInsert[] = [];

  parsed.data.forEach((raw, index) => {
    const rowNumber = index + 2; // +1 for header row, +1 for 1-indexing
    const name = raw.name?.trim();
    if (!name) {
      errors.push(`Row ${rowNumber}: missing required "name" column`);
      return;
    }

    let latitude: number | undefined;
    let longitude: number | undefined;

    if (raw.latitude?.trim()) {
      latitude = Number(raw.latitude);
      if (Number.isNaN(latitude)) {
        errors.push(`Row ${rowNumber}: invalid latitude "${raw.latitude}"`);
        latitude = undefined;
      }
    }
    if (raw.longitude?.trim()) {
      longitude = Number(raw.longitude);
      if (Number.isNaN(longitude)) {
        errors.push(`Row ${rowNumber}: invalid longitude "${raw.longitude}"`);
        longitude = undefined;
      }
    }

    rows.push({
      name,
      address_line1: raw.address_line1?.trim() || undefined,
      address_line2: raw.address_line2?.trim() || undefined,
      town: raw.town?.trim() || undefined,
      postcode: raw.postcode?.trim() || undefined,
      latitude,
      longitude,
      access_notes: raw.access_notes?.trim() || undefined,
      contact_name: raw.contact_name?.trim() || undefined,
      contact_phone: raw.contact_phone?.trim() || undefined,
      contact_email: raw.contact_email?.trim() || undefined,
      organisation: raw.organisation?.trim() || undefined,
    });
  });

  return { rows, errors };
}
