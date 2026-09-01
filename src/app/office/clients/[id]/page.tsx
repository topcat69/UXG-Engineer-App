import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ClientSites } from "./client-sites";
import { ClientProjects } from "./client-projects";

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: client }, { data: sites }, { data: projects }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).single(),
    supabase.from("sites").select("*").eq("client_id", id).order("name"),
    supabase
      .from("projects")
      .select("id, name, status, start_date, end_date")
      .eq("client_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (!client) notFound();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">{client.name}</h1>
        <p className="text-muted-foreground text-sm">
          {[client.contact_name, client.contact_email, client.contact_phone].filter(Boolean).join(" · ") ||
            "No contact details on file."}
        </p>
      </div>
      <ClientProjects clientId={client.id} projects={projects ?? []} />
      <ClientSites clientId={client.id} sites={sites ?? []} />
    </div>
  );
}
