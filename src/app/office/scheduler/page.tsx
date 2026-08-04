import Link from "next/link";
import { addDays, isoDate, mondayOf } from "@/lib/scheduler/week";
import { createClient } from "@/lib/supabase/server";
import { appBaseUrl } from "@/lib/app-url";
import { icsFeedUrl } from "@/lib/ics/sign";
import { SchedulerBoard } from "./scheduler-board";

export default async function SchedulerPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const sp = await searchParams;
  const monday = sp.week ? mondayOf(new Date(sp.week)) : mondayOf(new Date());
  const weekEnd = addDays(monday, 7);
  const days = Array.from({ length: 7 }, (_, i) => isoDate(addDays(monday, i)));

  const supabase = await createClient();
  const [{ data: engineers }, { data: jobs }] = await Promise.all([
    supabase
      .from("users")
      .select("id, name, max_jobs_per_day")
      .eq("role", "engineer")
      .eq("active", true)
      .order("name"),
    supabase
      .from("jobs")
      .select("id, job_number, status, assigned_to, scheduled_start, scheduled_end, site:sites(name)")
      .gte("scheduled_start", monday.toISOString())
      .lt("scheduled_start", weekEnd.toISOString())
      .order("scheduled_start"),
  ]);

  const prevWeek = isoDate(addDays(monday, -7));
  const nextWeek = isoDate(addDays(monday, 7));

  const base = appBaseUrl();
  const engineersWithFeed = (engineers ?? []).map((e) => ({ ...e, icsUrl: icsFeedUrl(e.id, base) }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Scheduler</h1>
        <div className="flex items-center gap-3 text-sm">
          <Link href={`?week=${prevWeek}`} className="border-input rounded-md border px-3 py-1 hover:bg-accent">
            ← Previous week
          </Link>
          <span className="text-muted-foreground">
            {monday.toLocaleDateString()} – {addDays(monday, 6).toLocaleDateString()}
          </span>
          <Link href={`?week=${nextWeek}`} className="border-input rounded-md border px-3 py-1 hover:bg-accent">
            Next week →
          </Link>
        </div>
      </div>

      <SchedulerBoard days={days} engineers={engineersWithFeed} jobs={(jobs ?? []) as never} />
    </div>
  );
}
