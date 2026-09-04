import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SitesManager } from "./sites-manager";

type SitesSearchParams = Record<string, string | string[] | undefined>;

function param(searchParams: SitesSearchParams, key: string): string {
  const value = searchParams[key];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

// Strips characters that would break PostgREST's or() filter syntax (comma
// separates conditions, parens group them) — same approach as the global
// office search (office/search/page.tsx).
function sanitizeTerm(raw: string): string {
  return raw.replace(/[,()]/g, " ").trim();
}

export default async function SitesPage({ searchParams }: { searchParams: Promise<SitesSearchParams> }) {
  const sp = await searchParams;
  const q = sanitizeTerm(param(sp, "q"));
  const clientId = param(sp, "client_id");
  const hasFilter = !!(q || clientId);

  const supabase = await createClient();

  let sitesQuery = supabase.from("sites").select("*").order("name");
  if (clientId) sitesQuery = sitesQuery.eq("client_id", clientId);
  if (q) {
    const like = `%${q}%`;
    sitesQuery = sitesQuery.or(`name.ilike.${like},address_line1.ilike.${like},town.ilike.${like},postcode.ilike.${like}`);
  }

  const [{ data: sites }, { data: jobs }, { data: clients }] = await Promise.all([
    sitesQuery,
    supabase.from("jobs").select("site_id"),
    supabase.from("clients").select("id, name").order("name"),
  ]);

  const jobCounts = new Map<string, number>();
  for (const j of jobs ?? []) {
    jobCounts.set(j.site_id, (jobCounts.get(j.site_id) ?? 0) + 1);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Sites</h1>
        <p className="text-muted-foreground text-sm">
          The individual locations jobs happen at — e.g. each store. A site belongs to exactly
          one customer but is reusable across all of that customer&apos;s projects. Add a site
          here and assign it to a customer, or reassign an existing one.
        </p>
      </div>

      <form className="flex flex-wrap items-end gap-2" method="get">
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground text-xs" htmlFor="q">
            Search
          </label>
          <input
            id="q"
            name="q"
            defaultValue={q}
            placeholder="Name, address, town, postcode"
            className="border-input h-9 rounded-md border bg-transparent px-3 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-muted-foreground text-xs" htmlFor="client_id">
            Customer
          </label>
          <select
            id="client_id"
            name="client_id"
            defaultValue={clientId}
            className="border-input h-9 rounded-md border bg-transparent px-3 text-sm"
          >
            <option value="">All</option>
            {(clients ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="border-input h-9 rounded-md border px-4 text-sm hover:bg-accent">
          Filter
        </button>
        {hasFilter && (
          <Link href="/office/sites" className="text-muted-foreground text-sm underline">
            Clear
          </Link>
        )}
      </form>

      <p className="text-muted-foreground text-sm">{(sites ?? []).length} site(s)</p>

      <SitesManager sites={sites ?? []} jobCounts={Object.fromEntries(jobCounts)} clients={clients ?? []} />
    </div>
  );
}
