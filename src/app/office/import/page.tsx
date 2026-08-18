import { createClient } from "@/lib/supabase/server";
import { ImportWizard } from "./import-wizard";

export default async function ImportPage() {
  const supabase = await createClient();
  const [{ data: projects }, { data: clients }, { data: sites }] = await Promise.all([
    supabase.from("projects").select("id, name").order("name"),
    supabase.from("clients").select("id, name").order("name"),
    supabase.from("sites").select("id"),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Import</h1>
      <ImportWizard
        projects={projects ?? []}
        clients={clients ?? []}
        allSiteIds={(sites ?? []).map((s) => s.id)}
      />
    </div>
  );
}
