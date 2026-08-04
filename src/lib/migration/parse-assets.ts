import type { Database } from "@/lib/supabase/database.types";
import { lookupId, optionalText, parseCsvRows, type ParseResult } from "./csv-helpers";

export type AssetInsert = Database["public"]["Tables"]["assets"]["Insert"];

/** Intermediate shape: `site_name` is a natural key, resolved to `site_id` by `resolveAssetRows` once the sites table has been imported. */
export type AssetImportRow = {
  siteName?: string;
  serial?: string;
  model?: string;
  asset_type?: string;
  install_date?: string;
  warranty_end?: string;
};

export function parseAssetsCsv(text: string): ParseResult<AssetImportRow> {
  const { data, errors: parseErrors } = parseCsvRows(text);
  const errors = [...parseErrors];
  const rows: AssetImportRow[] = data.map((raw) => ({
    siteName: optionalText(raw.site_name),
    serial: optionalText(raw.serial),
    model: optionalText(raw.model),
    asset_type: optionalText(raw.asset_type),
    install_date: optionalText(raw.install_date),
    warranty_end: optionalText(raw.warranty_end),
  }));
  return { rows, errors };
}

/** `site_id` is nullable in the schema, so a blank `site_name` isn't an error — only a *non-blank* name that doesn't match an imported site is. */
export function resolveAssetRows(
  rows: AssetImportRow[],
  siteLookup: Map<string, string>,
): ParseResult<AssetInsert> {
  const errors: string[] = [];
  const resolved: AssetInsert[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const siteId = row.siteName ? lookupId(siteLookup, row.siteName) : undefined;
    if (row.siteName && !siteId) {
      errors.push(`Row ${rowNumber}: unknown site "${row.siteName}"`);
      return;
    }
    resolved.push({
      site_id: siteId,
      serial: row.serial,
      model: row.model,
      asset_type: row.asset_type,
      install_date: row.install_date,
      warranty_end: row.warranty_end,
    });
  });

  return { rows: resolved, errors };
}
