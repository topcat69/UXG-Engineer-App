import { createClient } from "@/lib/supabase/server";
import { ProjectsManager } from "./projects-manager";

export default async function ProjectsPage() {
  const supabase = await createClient();
  const { data: projects } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
  const { data: jobs } = await supabase.from("jobs").select("project_id");

  const jobCounts = new Map<string, number>();
  for (const j of jobs ?? []) {
    if (j.project_id) jobCounts.set(j.project_id, (jobCounts.get(j.project_id) ?? 0) + 1);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Projects</h1>
        <p className="text-muted-foreground text-sm">
          A container for organising jobs (e.g. by year) — not tied to a single client. One
          project can hold jobs for many different clients at once.
        </p>
      </div>
      <ProjectsManager projects={projects ?? []} jobCounts={Object.fromEntries(jobCounts)} />
    </div>
  );
}
