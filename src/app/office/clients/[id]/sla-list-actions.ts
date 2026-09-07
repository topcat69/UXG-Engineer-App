"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseSlaListCsv } from "@/lib/csv/sla-lists";

export type SlaListRow = { id: string; name: string };
type SlaListResult = { ok: true; item: SlaListRow } | { ok: false; message: string };
type DeleteResult = { ok: true } | { ok: false; message: string };
type ImportResult = { ok: true; message: string } | { ok: false; message: string };

type SlaListTable = "client_sla_fixture_types" | "client_sla_reasons";

/**
 * Shared implementation for both client_sla_fixture_types and
 * client_sla_reasons — identical shape (id, client_id, name), identical
 * CRUD + CSV-import behaviour, strictly scoped per customer per product
 * decision (Currys must never see Halfords' fixtures/reasons, or vice
 * versa). Exported below as named-per-entity wrappers so the manager
 * component and its callers read as concrete actions, not a generic table
 * name threaded through props.
 */
async function createItem(table: SlaListTable, clientId: string, name: string): Promise<SlaListResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, message: "Name is required." };

  const supabase = await createClient();
  const { data, error } = await supabase.from(table).insert({ client_id: clientId, name: trimmed }).select("id, name").single();
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/office/clients/${clientId}`);
  return { ok: true, item: data };
}

async function updateItem(table: SlaListTable, clientId: string, itemId: string, name: string): Promise<SlaListResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, message: "Name is required." };

  const supabase = await createClient();
  const { data, error } = await supabase.from(table).update({ name: trimmed }).eq("id", itemId).select("id, name").single();
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/office/clients/${clientId}`);
  return { ok: true, item: data };
}

/** RESTRICT, no cascade (see 20260907010000_job_details_sla_fields.sql) — a fixture type/reason still referenced by job_details can't be silently deleted out from under that job's history. */
async function deleteItem(table: SlaListTable, clientId: string, itemId: string): Promise<DeleteResult> {
  const supabase = await createClient();
  const { error } = await supabase.from(table).delete().eq("id", itemId);
  if (error) {
    if (error.code === "23503") {
      return { ok: false, message: "Can't delete — this is still in use on at least one SLA job." };
    }
    return { ok: false, message: error.message };
  }

  revalidatePath(`/office/clients/${clientId}`);
  return { ok: true };
}

async function importCsv(table: SlaListTable, clientId: string, formData: FormData): Promise<ImportResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Choose a CSV file first." };

  const text = await file.text();
  const { rows, errors } = parseSlaListCsv(text);
  if (rows.length === 0) return { ok: false, message: errors[0] ?? "No valid rows found." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from(table)
    .insert(rows.map((r) => ({ client_id: clientId, name: r.name })))
    .select("id");
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/office/clients/${clientId}`);
  const suffix = errors.length > 0 ? ` (${errors.length} row(s) skipped: ${errors.slice(0, 3).join("; ")})` : "";
  return { ok: true, message: `Imported ${data.length} row(s).${suffix}` };
}

// Next.js's Server Function compiler only recognises plain `export async
// function` declarations, not arrow-function const exports — see
// node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-server.md's
// examples, all of which use that shape. Each of these is a thin
// `async function` wrapper (required) around the shared implementations
// above (not required to be exported themselves, so they aren't).

export async function createFixtureType(clientId: string, name: string): Promise<SlaListResult> {
  return createItem("client_sla_fixture_types", clientId, name);
}
export async function updateFixtureType(clientId: string, itemId: string, name: string): Promise<SlaListResult> {
  return updateItem("client_sla_fixture_types", clientId, itemId, name);
}
export async function deleteFixtureType(clientId: string, itemId: string): Promise<DeleteResult> {
  return deleteItem("client_sla_fixture_types", clientId, itemId);
}
export async function importFixtureTypesCsv(clientId: string, formData: FormData): Promise<ImportResult> {
  return importCsv("client_sla_fixture_types", clientId, formData);
}

export async function createReason(clientId: string, name: string): Promise<SlaListResult> {
  return createItem("client_sla_reasons", clientId, name);
}
export async function updateReason(clientId: string, itemId: string, name: string): Promise<SlaListResult> {
  return updateItem("client_sla_reasons", clientId, itemId, name);
}
export async function deleteReason(clientId: string, itemId: string): Promise<DeleteResult> {
  return deleteItem("client_sla_reasons", clientId, itemId);
}
export async function importReasonsCsv(clientId: string, formData: FormData): Promise<ImportResult> {
  return importCsv("client_sla_reasons", clientId, formData);
}
