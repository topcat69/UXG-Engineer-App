import { createClient } from "@/lib/supabase/server";
import { ClientsManager } from "./clients-manager";

export default async function ClientsPage() {
  const supabase = await createClient();
  const { data: clients } = await supabase.from("clients").select("*").order("name");
  const { data: sites } = await supabase.from("sites").select("client_id");

  const siteCounts = new Map<string, number>();
  for (const s of sites ?? []) {
    siteCounts.set(s.client_id, (siteCounts.get(s.client_id) ?? 0) + 1);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Clients</h1>
        <p className="text-muted-foreground text-sm">
          The businesses this app does work for — e.g. a client with 200 stores gets one client
          record and 200 sites underneath it. Jobs reference a site, so a job&apos;s client is
          always identifiable for reporting.
        </p>
      </div>
      <ClientsManager clients={clients ?? []} siteCounts={Object.fromEntries(siteCounts)} />
    </div>
  );
}
