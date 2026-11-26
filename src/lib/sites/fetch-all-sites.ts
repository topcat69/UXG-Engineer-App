import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type AnySupabaseClient = SupabaseClient<Database>;

export type SiteWithClient = { id: string; name: string; client: { name: string } | null };

const PAGE_SIZE = 1000;

/**
 * PostgREST silently caps a plain, unranged .select() at its own row limit
 * (1000 here) — a sites list bigger than that just drops the rest, no
 * error. That used to only bite the Add/Edit form's site search box (see
 * SiteSearchSelect's own comment on the exact same cap), until the Asset
 * Register table's Client/Site columns started hitting it too: they look
 * sites up from this same flat list, so a site sorting past the cap shows
 * "Unassigned" for every asset pointed at it, even though site_id is
 * correctly set — confirmed live, where editing one of those assets still
 * showed its real site in the (uncapped, per-row-joined) Edit form.
 */
export async function fetchAllSites(supabase: AnySupabaseClient): Promise<SiteWithClient[]> {
  const all: SiteWithClient[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("sites")
      .select("id, name, client:clients(name)")
      .order("name")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    all.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}
