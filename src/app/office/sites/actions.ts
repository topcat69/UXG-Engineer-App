"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { geocodePostcode } from "@/lib/geo/postcode";
import type { Database } from "@/lib/supabase/database.types";

export type SiteRow = Database["public"]["Tables"]["sites"]["Row"];
export type CreateSiteResult = { ok: true; site: SiteRow } | { ok: false; message: string };

export async function createSite(input: {
  client_id: string;
  name: string;
  store_id?: string;
  address_line1?: string;
  town?: string;
  postcode?: string;
  contact_name?: string;
  contact_phone?: string;
}): Promise<CreateSiteResult> {
  const name = input.name.trim();
  if (!name) return { ok: false, message: "Name is required." };
  if (!input.client_id) return { ok: false, message: "Select a customer." };

  const postcode = input.postcode?.trim() || undefined;
  // Best-effort — a site with no/unrecognised postcode is still created,
  // it just won't have coordinates yet (no marker on the dashboard map,
  // and check-in falls back to live GPS only rather than GPS-or-postcode;
  // see the postcode-fallback and dashboard-map addenda in DECISIONS.md).
  const coords = postcode ? await geocodePostcode(postcode) : null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sites")
    .insert({
      client_id: input.client_id,
      name,
      store_id: input.store_id?.trim() || undefined,
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

  revalidatePath("/office/sites");
  revalidatePath(`/office/clients/${input.client_id}`);
  revalidatePath("/office/dashboard");
  return { ok: true, site: data };
}

export type UpdateSiteResult = { ok: true; site: SiteRow } | { ok: false; message: string };

export async function updateSite(
  id: string,
  input: {
    client_id: string;
    name: string;
    store_id?: string;
    address_line1?: string;
    town?: string;
    postcode?: string;
    contact_name?: string;
    contact_phone?: string;
  },
): Promise<UpdateSiteResult> {
  const name = input.name.trim();
  if (!name) return { ok: false, message: "Name is required." };
  if (!input.client_id) return { ok: false, message: "Select a customer." };

  const postcode = input.postcode?.trim() || null;
  // Re-geocoded on every save (not just when the postcode value changes) —
  // this doubles as the backfill path for sites created before this app
  // knew how to geocode at all: re-saving one now picks up coordinates.
  // A failed/unrecognised lookup leaves latitude/longitude untouched
  // rather than nulling out coordinates a previous successful save set —
  // a transient geocoding hiccup shouldn't be able to un-plot a site that
  // was already on the map.
  const coords = postcode ? await geocodePostcode(postcode) : null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sites")
    .update({
      client_id: input.client_id,
      name,
      store_id: input.store_id?.trim() || null,
      address_line1: input.address_line1?.trim() || null,
      town: input.town?.trim() || null,
      postcode,
      contact_name: input.contact_name?.trim() || null,
      contact_phone: input.contact_phone?.trim() || null,
      ...(coords ? { latitude: coords.latitude, longitude: coords.longitude } : {}),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) return { ok: false, message: error.message };

  revalidatePath("/office/sites");
  revalidatePath(`/office/clients/${input.client_id}`);
  revalidatePath("/office/dashboard");
  return { ok: true, site: data };
}

export type DeleteResult = { ok: true } | { ok: false; message: string };

/** A site can't be deleted while it still has jobs — the FK is a plain RESTRICT (no cascade): deleting a site should never silently take job history with it. */
export async function deleteSite(id: string): Promise<DeleteResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("sites").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      return { ok: false, message: "Can't delete — this site still has jobs against it." };
    }
    return { ok: false, message: error.message };
  }

  revalidatePath("/office/sites");
  revalidatePath("/office/dashboard");
  return { ok: true };
}
