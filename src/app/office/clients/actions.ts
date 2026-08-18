"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { parseClientsCsv } from "@/lib/csv/clients";
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

  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("sites")
    .insert({
      client_id: clientId,
      name,
      address_line1: input.address_line1?.trim() || undefined,
      town: input.town?.trim() || undefined,
      postcode: input.postcode?.trim() || undefined,
      contact_name: input.contact_name?.trim() || undefined,
      contact_phone: input.contact_phone?.trim() || undefined,
    })
    .select("*")
    .single();
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/office/clients/${clientId}`);
  return { ok: true, site: data };
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
