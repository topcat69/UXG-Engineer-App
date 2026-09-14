import Papa from "papaparse";
import type { Database } from "@/lib/supabase/database.types";

type AssetStatus = Database["public"]["Enums"]["asset_status"];
const ASSET_STATUSES: AssetStatus[] = ["spare", "in_use", "faulty", "in_repair", "retired"];

export type AssetRegisterInsert = Database["public"]["Tables"]["asset_register"]["Insert"];

/** Intermediate shape: category/site/client are natural-key text, resolved to real foreign keys by resolveAssetRegisterRows once the caller knows the current categories/sites. */
export type AssetRegisterImportRow = {
  categoryName?: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  siteName?: string;
  clientName?: string;
  purchaseDate?: string;
  supplier?: string;
  poOrInvoiceNumber?: string;
  purchaseCost?: number;
  depreciationMethod?: string;
  usefulLifeYears?: number;
  residualValue?: number;
  warrantyStart?: string;
  warrantyEnd?: string;
  warrantyProvider?: string;
  supportContractRef?: string;
  supportSla?: string;
  status: AssetStatus;
  expectedReplacementDate?: string;
  decommissionDate?: string;
  disposalDate?: string;
  weeeReference?: string;
};

export type ParsedAssetRegisterCsv = { rows: AssetRegisterImportRow[]; errors: string[] };

function optionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function optionalDate(value: string | undefined, field: string, rowNumber: number, errors: string[]): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) {
    errors.push(`Row ${rowNumber}: invalid ${field} "${trimmed}"`);
    return undefined;
  }
  return d.toISOString().slice(0, 10);
}

function optionalNumber(value: string | undefined, field: string, rowNumber: number, errors: string[]): number | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) {
    errors.push(`Row ${rowNumber}: invalid ${field} "${trimmed}"`);
    return undefined;
  }
  return n;
}

function optionalInt(value: string | undefined, field: string, rowNumber: number, errors: string[]): number | undefined {
  const n = optionalNumber(value, field, rowNumber, errors);
  return n != null ? Math.trunc(n) : undefined;
}

/**
 * Pure CSV -> row parser (no Supabase call), so it's unit-testable — same
 * shape as parseSitesCsv/parseClientsCsv. `category`/`site`/`client` stay
 * as natural-key text here; resolveAssetRegisterRows turns them into real
 * foreign keys afterwards, once the caller has looked up (and, for
 * category, created on the fly) matching rows from the database.
 *
 * There's no `install_date` column, same as the manual "Add asset
 * manually" form — it's only ever set automatically, once, when the job
 * an asset is actually part of gets submitted (see
 * api/webhooks/status-submitted). A legacy asset with no job behind it
 * simply has no install_date; there's nowhere else for a trustworthy one
 * to come from.
 */
export function parseAssetRegisterCsv(text: string): ParsedAssetRegisterCsv {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  const errors: string[] = parsed.errors.map((e) => `Row ${(e.row ?? 0) + 2}: ${e.message}`);
  const rows: AssetRegisterImportRow[] = [];

  parsed.data.forEach((raw, index) => {
    const rowNumber = index + 2; // +1 for header row, +1 for 1-indexing

    let status: AssetStatus = "spare";
    const rawStatus = raw.status?.trim().toLowerCase().replace(/\s+/g, "_");
    if (rawStatus) {
      const match = ASSET_STATUSES.find((s) => s === rawStatus);
      if (!match) {
        errors.push(`Row ${rowNumber}: unrecognised status "${raw.status}" (expected one of ${ASSET_STATUSES.join(", ")})`);
      } else {
        status = match;
      }
    }

    // Mirrors the asset_register_site_required_unless_spare check
    // constraint, so a bad row is reported here rather than as a raw
    // Postgres error after everything else in the file already succeeded.
    const siteName = optionalText(raw.site);
    if (status !== "spare" && !siteName) {
      errors.push(`Row ${rowNumber}: site is required unless status is spare`);
      return;
    }

    rows.push({
      categoryName: optionalText(raw.category),
      manufacturer: optionalText(raw.manufacturer),
      model: optionalText(raw.model),
      serialNumber: optionalText(raw.serial_number),
      siteName,
      clientName: optionalText(raw.client),
      purchaseDate: optionalDate(raw.purchase_date, "purchase_date", rowNumber, errors),
      supplier: optionalText(raw.supplier),
      poOrInvoiceNumber: optionalText(raw.po_or_invoice_number),
      purchaseCost: optionalNumber(raw.purchase_cost, "purchase_cost", rowNumber, errors),
      depreciationMethod: optionalText(raw.depreciation_method),
      usefulLifeYears: optionalInt(raw.useful_life_years, "useful_life_years", rowNumber, errors),
      residualValue: optionalNumber(raw.residual_value, "residual_value", rowNumber, errors),
      warrantyStart: optionalDate(raw.warranty_start, "warranty_start", rowNumber, errors),
      warrantyEnd: optionalDate(raw.warranty_end, "warranty_end", rowNumber, errors),
      warrantyProvider: optionalText(raw.warranty_provider),
      supportContractRef: optionalText(raw.support_contract_ref),
      supportSla: optionalText(raw.support_sla),
      status,
      expectedReplacementDate: optionalDate(raw.expected_replacement_date, "expected_replacement_date", rowNumber, errors),
      decommissionDate: optionalDate(raw.decommission_date, "decommission_date", rowNumber, errors),
      disposalDate: optionalDate(raw.disposal_date, "disposal_date", rowNumber, errors),
      weeeReference: optionalText(raw.weee_reference),
    });
  });

  return { rows, errors };
}

export type SiteLookupEntry = { id: string; clientName: string | null };

/** Case-insensitive site-name -> candidate list: two different clients can each have a site with the same name (e.g. two "Head Office"s), so a name alone doesn't always resolve to one row. */
export function buildSiteLookup(sites: { id: string; name: string; clientName: string | null }[]): Map<string, SiteLookupEntry[]> {
  const map = new Map<string, SiteLookupEntry[]>();
  for (const site of sites) {
    const key = site.name.trim().toLowerCase();
    const list = map.get(key) ?? [];
    list.push({ id: site.id, clientName: site.clientName });
    map.set(key, list);
  }
  return map;
}

export function buildCategoryLookup(categories: { id: string; name: string }[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const c of categories) map.set(c.name.trim().toLowerCase(), c.id);
  return map;
}

function resolveSiteId(
  siteLookup: Map<string, SiteLookupEntry[]>,
  siteName: string | undefined,
  clientName: string | undefined,
  rowNumber: number,
  errors: string[],
): string | undefined {
  if (!siteName) return undefined;
  const candidates = siteLookup.get(siteName.trim().toLowerCase()) ?? [];
  if (candidates.length === 0) {
    errors.push(`Row ${rowNumber}: unknown site "${siteName}"`);
    return undefined;
  }
  if (candidates.length === 1) return candidates[0].id;

  if (!clientName) {
    errors.push(`Row ${rowNumber}: "${siteName}" matches more than one site — add a "client" column to say which one`);
    return undefined;
  }
  const match = candidates.find((c) => (c.clientName ?? "").trim().toLowerCase() === clientName.trim().toLowerCase());
  if (!match) {
    errors.push(`Row ${rowNumber}: no site named "${siteName}" for client "${clientName}"`);
    return undefined;
  }
  return match.id;
}

export type ResolvedAssetRegisterCsv = { rows: AssetRegisterInsert[]; errors: string[] };

/**
 * Turns each row's natural-key text (category/site/client) into real
 * foreign keys. categoryLookup should already include any brand-new
 * categories the caller decided to create on the fly (see
 * importAssetRegisterCsv) — by the time rows reach here, an unrecognised
 * category is always a genuine typo, not a legitimately-new one. Sites
 * are never created on the fly: an unknown site name is always an error,
 * since a site carries far more detail than this file has room for.
 */
export function resolveAssetRegisterRows(
  rows: AssetRegisterImportRow[],
  categoryLookup: Map<string, string>,
  siteLookup: Map<string, SiteLookupEntry[]>,
): ResolvedAssetRegisterCsv {
  const errors: string[] = [];
  const resolved: AssetRegisterInsert[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;

    let categoryId: string | undefined;
    if (row.categoryName) {
      categoryId = categoryLookup.get(row.categoryName.trim().toLowerCase());
      if (!categoryId) {
        errors.push(`Row ${rowNumber}: unknown category "${row.categoryName}"`);
        return;
      }
    }

    const siteId = resolveSiteId(siteLookup, row.siteName, row.clientName, rowNumber, errors);
    if (row.siteName && !siteId) return;

    resolved.push({
      category_id: categoryId,
      manufacturer: row.manufacturer,
      model: row.model,
      serial_number: row.serialNumber,
      site_id: siteId,
      purchase_date: row.purchaseDate,
      supplier: row.supplier,
      po_or_invoice_number: row.poOrInvoiceNumber,
      purchase_cost: row.purchaseCost,
      depreciation_method: row.depreciationMethod,
      useful_life_years: row.usefulLifeYears,
      residual_value: row.residualValue,
      warranty_start: row.warrantyStart,
      warranty_end: row.warrantyEnd,
      warranty_provider: row.warrantyProvider,
      support_contract_ref: row.supportContractRef,
      support_sla: row.supportSla,
      status: row.status,
      expected_replacement_date: row.expectedReplacementDate,
      decommission_date: row.decommissionDate,
      disposal_date: row.disposalDate,
      weee_reference: row.weeeReference,
      source: "import",
      needs_review: false,
    });
  });

  return { rows: resolved, errors };
}
