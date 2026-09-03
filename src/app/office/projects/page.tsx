import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProjectsManager } from "./projects-manager";

export default async function ProjectsPage() {
  const supabase = await createClient();
  const [{ data: projects }, { data: jobs }, { data: clients }] = await Promise.all([
    supabase.from("projects").select("*").order("created_at", { ascending: false }),
    supabase.from("jobs").select("project_id"),
    supabase.from("clients").select("id, name").order("name"),
  ]);

  const jobCounts = new Map<string, number>();
  for (const j of jobs ?? []) {
    if (j.project_id) jobCounts.set(j.project_id, (jobCounts.get(j.project_id) ?? 0) + 1);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Projects</h1>
        <p className="text-muted-foreground text-sm">
          A container for organising one customer&apos;s jobs (e.g. by year) — every project
          belongs to exactly one customer. Sites stay reusable across all of that customer&apos;s
          projects. To add a new project, go to the customer&apos;s{" "}
          <Link href="/office/clients" className="underline">
            Customers page
          </Link>{" "}
          first — edit an existing project&apos;s name, dates, status, or customer here.
        </p>
      </div>
      <ProjectsManager projects={projects ?? []} jobCounts={Object.fromEntries(jobCounts)} clients={clients ?? []} />
    </div>
  );
}
