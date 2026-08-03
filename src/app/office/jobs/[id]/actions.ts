"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import type { ActionResult } from "../actions";

export async function raiseIssue(jobId: string, siteId: string, formData: FormData): Promise<ActionResult> {
  const severity = String(formData.get("severity") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  if (!severity || !description) return { ok: false, message: "Severity and description are required." };

  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Not signed in." };

  const supabase = await createClient();
  const { error } = await supabase.from("issues").insert({
    job_id: jobId,
    site_id: siteId,
    raised_by: user.id,
    severity,
    description,
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/office/jobs/${jobId}`);
  return { ok: true, message: "Issue raised." };
}
