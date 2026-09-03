import { createClient } from "@/lib/supabase/server";
import { SitesManager } from "./sites-manager";

export default async function SitesPage() {
  const supabase = await createClient();
  const [{ data: sites }, { data: jobs }, { data: clients }] = await Promise.all([
    supabase.from("sites").select("*").order("name"),
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
      <SitesManager sites={sites ?? []} jobCounts={Object.fromEntries(jobCounts)} clients={clients ?? []} />
    </div>
  );
}
