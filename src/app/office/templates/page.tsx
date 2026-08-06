import { createClient } from "@/lib/supabase/server";
import { TemplatesManager } from "./templates-manager";

export default async function TemplatesPage() {
  const supabase = await createClient();
  const [{ data: templates }, { data: tasks }] = await Promise.all([
    supabase.from("job_templates").select("id, name").order("name"),
    supabase.from("job_template_tasks").select("id, template_id, position, label").order("position"),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Job templates</h1>
        <p className="text-muted-foreground text-sm">
          A reusable task checklist you can apply to any job for the assigned engineer to work through.
        </p>
      </div>
      <TemplatesManager templates={templates ?? []} tasks={tasks ?? []} />
    </div>
  );
}
