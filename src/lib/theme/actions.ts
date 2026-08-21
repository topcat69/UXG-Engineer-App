"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { THEMES } from "./themes";

/**
 * Persists the caller's own theme choice via set_own_theme (see
 * 20260123000000_user_theme.sql) rather than a direct `.update()` — users
 * table writes are otherwise superadmin-only (users_write RLS policy), and
 * RLS can't be scoped to just the theme column, so this goes through a
 * SECURITY DEFINER function instead of widening that policy. Revalidates
 * the whole layout tree (not just one path) since the theme class is
 * rendered by the root layout, above every route.
 */
export async function updateTheme(theme: string): Promise<void> {
  if (!(THEMES as readonly string[]).includes(theme)) return;

  const supabase = await createClient();
  await supabase.rpc("set_own_theme", { new_theme: theme });
  revalidatePath("/", "layout");
}
