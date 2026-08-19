"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { parseClientsCsv } from "@/lib/csv/clients";
import { geocodePostcode } from "@/lib/geo/postcode";
import type { Database } from "@/lib/supabase/database.types";

export type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
export type CreateClientResult = { ok: true; client: ClientRow } | { ok: false; message: string };
export type ImportClientsResult = { ok: true; message: string } | { ok: false; message: string };

export async function createClientRecord(input: {
  name: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  notes?: string;
}): Promise<CreateClientResult> {
  const name = input.name.trim();
  if (!name) return { ok: false, message: "Name is required." };

  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("clients")
    .insert({
      name,
      contact_name: input.contact_name?.trim() || undefined,
      contact_email: input.contact_email?.trim() || undefined,
      contact_phone: input.contact_phone?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
    })
    .select("*")
    .single();
  if (error) return { ok: false, message: error.message };

  revalidatePath("/office/clients");
  return { ok: true, client: data };
}

export type UpdateClientResult = { ok: true; client: ClientRow } | { ok: false; message: string };
export type DeleteResult = { ok: true } | { ok: false; message: string };

export async function updateClientRecord(
  clientId: string,
  input: { name: string; contact_name?: string; contact_email?: string; contact_phone?: string; notes?: string },
): Promise<UpdateClientResult> {
  const name = input.name.trim();
  if (!name) return { ok: false, message: "Name is required." };

  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("clients")
    .update({
      name,
      contact_name: input.contact_name?.trim() || null,
      contact_email: input.contact_email?.trim() || null,
      contact_phone: input.contact_phone?.trim() || null,
      notes: input.notes?.trim() || null,
    })
    .eq("id", clientId)
    .select("*")
    .single();
  if (error) return { ok: false, message: error.message };

  revalidatePath("/office/clients");
  revalidatePath(`/office/clients/${clientId}`);
  return { ok: true, client: data };
}

/** A client can't be deleted while it still has sites — the FK is a plain RESTRICT (no cascade), by design: deleting a client should never silently orphan/wipe out site history. */
export async function deleteClientRecord(clientId: string): Promise<DeleteResult> {
  const supabase = await createSupabaseClient();
  const { error } = await supabase.from("clients").delete().eq("id", clientId);
  if (error) {
    if (error.code === "23503") {
      return { ok: false, message: "Can't delete — this client still has sites. Remove or reassign them first." };
    }
    return { ok: false, message: error.message };
  }

  revalidatePath("/office/clients");
  return { ok: true };
}

export type SiteRow = Database["public"]["Tables"]["sites"]["Row"];
export type CreateSiteResult = { ok: true; site: SiteRow } | { ok: false; message: string };

export async function createSiteForClient(
  clientId: string,
  input: {
    name: string;
    address_line1?: string;
    town?: string;
    postcode?: string;
    contact_name?: string;
    contact_phone?: string;
  },
): Promise<CreateSiteResult> {
  const name = input.name.trim();
  if (!name) return { ok: false, message: "Name is required." };

  const postcode = input.postcode?.trim() || undefined;
  // Best-effort — a site with no/unrecognised postcode is still created,
  // it just won't have coordinates yet (no marker on the dashboard map,
  // and check-in falls back to live GPS only rather than GPS-or-postcode;
  // see the postcode-fallback and dashboard-map addenda in DECISIONS.md).
  const coords = postcode ? await geocodePostcode(postcode) : null;

  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("sites")
    .insert({
      client_id: clientId,
      name,
      address_line1: input.address_line1?.trim() || undefined,
      town: input.town?.trim() || undefined,
      postcode,
      contact_name: input.contact_name?.trim() || undefined,
      contact_phone: input.contact_phone?.trim() || undefined,
      latitude: coords?.latitude ?? undefined,
      longitude: coords?.longitude ?? undefined,
    })
    .select("*")
    .single();
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/office/clients/${clientId}`);
  revalidatePath("/office/dashboard");
  return { ok: true, site: data };
}

export type UpdateSiteResult = { ok: true; site: SiteRow } | { ok: false; message: string };

export async function updateSiteForClient(
  siteId: string,
  clientId: string,
  input: {
    name: string;
    address_line1?: string;
    town?: string;
    postcode?: string;
    contact_name?: string;
    contact_phone?: string;
  },
): Promise<UpdateSiteResult> {
  const name = input.name.trim();
  if (!name) return { ok: false, message: "Name is required." };

  const postcode = input.postcode?.trim() || null;
  // Re-geocoded on every save (not just when the postcode value changes) —
  // this doubles as the backfill path for sites created before this app
  // knew how to geocode at all: re-saving one now picks up coordinates.
  // A failed/unrecognised lookup leaves latitude/longitude untouched
  // rather than nulling out coordinates a previous successful save set —
  // a transient geocoding hiccup shouldn't be able to un-plot a site that
  // was already on the map.
  const coords = postcode ? await geocodePostcode(postcode) : null;

  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("sites")
    .update({
      name,
      address_line1: input.address_line1?.trim() || null,
      town: input.town?.trim() || null,
      postcode,
      contact_name: input.contact_name?.trim() || null,
      contact_phone: input.contact_phone?.trim() || null,
      ...(coords ? { latitude: coords.latitude, longitude: coords.longitude } : {}),
    })
    .eq("id", siteId)
    .select("*")
    .single();
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/office/clients/${clientId}`);
  revalidatePath("/office/dashboard");
  return { ok: true, site: data };
}

/** A site can't be deleted while it still has jobs — the FK is a plain RESTRICT (no cascade), same reasoning as deleteClientRecord: deleting a site should never silently take job history with it. */
export async function deleteSiteForClient(siteId: string, clientId: string): Promise<DeleteResult> {
  const supabase = await createSupabaseClient();
  const { error } = await supabase.from("sites").delete().eq("id", siteId);
  if (error) {
    if (error.code === "23503") {
      return { ok: false, message: "Can't delete — this site still has jobs against it." };
    }
    return { ok: false, message: error.message };
  }

  revalidatePath(`/office/clients/${clientId}`);
  return { ok: true };
}

export async function importClientsCsv(formData: FormData): Promise<ImportClientsResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose a CSV file first." };
  }

  const text = await file.text();
  const { rows, errors } = parseClientsCsv(text);
  if (rows.length === 0) {
    return { ok: false, message: errors[0] ?? "No valid rows found." };
  }

  const supabase = await createSupabaseClient();
  const { data, error } = await supabase.from("clients").insert(rows).select("id");
  if (error) return { ok: false, message: error.message };

  revalidatePath("/office/clients");
  const suffix = errors.length > 0 ? ` (${errors.length} row(s) skipped: ${errors.slice(0, 3).join("; ")})` : "";
  return { ok: true, message: `Imported ${data.length} client(s).${suffix}` };
}
