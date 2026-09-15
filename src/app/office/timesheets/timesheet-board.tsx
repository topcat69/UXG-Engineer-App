import type { TimesheetMinutes } from "@/lib/jobs/worked-duration";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Bar widths are scaled against a fixed 10-hour reference rather than each
// row's or column's own max, so a 3-hour day and an 8-hour day are visually
// comparable across the whole grid, the same way the scheduler board's
// fixed 7-day-wide grid keeps every week visually comparable.
const MAX_MINUTES = 10 * 60;

function formatMinutes(minutes: number): string {
  if (minutes === 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? (m > 0 ? `${h}h${m}m` : `${h}h`) : `${m}m`;
}

const EMPTY: TimesheetMinutes = { travelMinutes: 0, workMinutes: 0, totalMinutes: 0 };

export function TimesheetBoard({
  days,
  engineers,
  minutesByEngineer,
}: {
  days: string[];
  engineers: { id: string; name: string }[];
  minutesByEngineer: Record<string, Record<string, TimesheetMinutes>>;
}) {
  const dayTotals = days.map((day) =>
    engineers.reduce(
      (sum, e) => {
        const m = minutesByEngineer[e.id]?.[day] ?? EMPTY;
        return { travelMinutes: sum.travelMinutes + (m.travelMinutes ?? 0), workMinutes: sum.workMinutes + (m.workMinutes ?? 0) };
      },
      { travelMinutes: 0, workMinutes: 0 },
    ),
  );
  const weekTotals = engineers.map((e) =>
    days.reduce(
      (sum, day) => {
        const m = minutesByEngineer[e.id]?.[day] ?? EMPTY;
        return { travelMinutes: sum.travelMinutes + (m.travelMinutes ?? 0), workMinutes: sum.workMinutes + (m.workMinutes ?? 0) };
      },
      { travelMinutes: 0, workMinutes: 0 },
    ),
  );
  const grandTotal = dayTotals.reduce(
    (sum, d) => ({ travelMinutes: sum.travelMinutes + d.travelMinutes, workMinutes: sum.workMinutes + d.workMinutes }),
    { travelMinutes: 0, workMinutes: 0 },
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto">
        <div className="grid min-w-[900px] grid-cols-[160px_repeat(7,1fr)_100px] gap-1">
          <div />
          {days.map((day, i) => (
            <div key={day} className="text-center text-xs font-medium text-muted-foreground">
              {DAY_LABELS[i]} {new Date(day).getDate()}
            </div>
          ))}
          <div className="text-center text-xs font-medium text-muted-foreground">Week</div>

          {engineers.length === 0 && (
            <div className="col-span-9 text-muted-foreground py-6 text-center text-sm">No active engineers.</div>
          )}
          {engineers.map((engineer, i) => (
            <FragmentRow key={engineer.id} name={engineer.name} days={days} minutes={minutesByEngineer[engineer.id] ?? {}} weekTotal={weekTotals[i]} />
          ))}

          <div className="pt-2 text-sm font-medium">Total</div>
          {dayTotals.map((total, i) => (
            <div key={days[i]} className="flex flex-col items-center gap-1 pt-2">
              <TimeBar travelMinutes={total.travelMinutes} workMinutes={total.workMinutes} />
              <span className="text-xs font-medium tabular-nums">{formatMinutes(total.travelMinutes + total.workMinutes)}</span>
            </div>
          ))}
          <div className="flex flex-col items-center gap-1 pt-2">
            <span className="text-xs font-semibold tabular-nums">{formatMinutes(grandTotal.travelMinutes + grandTotal.workMinutes)}</span>
          </div>
        </div>
      </div>
      <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-500" />
          Travel
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-blue-500" />
          On-site work
        </span>
        <span>· Bar length is scaled against a 10-hour day</span>
      </div>
    </div>
  );
}

function FragmentRow({
  name,
  days,
  minutes,
  weekTotal,
}: {
  name: string;
  days: string[];
  minutes: Record<string, TimesheetMinutes>;
  weekTotal: { travelMinutes: number; workMinutes: number };
}) {
  return (
    <>
      <div className="flex items-center text-sm font-medium">{name}</div>
      {days.map((day) => {
        const m = minutes[day] ?? EMPTY;
        return (
          <div key={day} className="flex flex-col items-center gap-1 rounded-md border p-1">
            <TimeBar travelMinutes={m.travelMinutes ?? 0} workMinutes={m.workMinutes ?? 0} />
            <span className="text-xs tabular-nums">{formatMinutes((m.travelMinutes ?? 0) + (m.workMinutes ?? 0))}</span>
          </div>
        );
      })}
      <div className="flex items-center justify-center text-sm font-medium tabular-nums">
        {formatMinutes(weekTotal.travelMinutes + weekTotal.workMinutes)}
      </div>
    </>
  );
}

function TimeBar({ travelMinutes, workMinutes }: { travelMinutes: number; workMinutes: number }) {
  const total = travelMinutes + workMinutes;
  if (total === 0) {
    return <div className="h-2 w-full rounded-full bg-muted" />;
  }
  const travelPct = Math.min(100, (travelMinutes / MAX_MINUTES) * 100);
  const workPct = Math.min(100 - travelPct, (workMinutes / MAX_MINUTES) * 100);
  return (
    <div
      className="flex h-2 w-full overflow-hidden rounded-full bg-muted"
      title={`Travel ${formatMinutes(travelMinutes)} · Work ${formatMinutes(workMinutes)}`}
    >
      <div className="h-full bg-amber-500" style={{ width: `${travelPct}%` }} />
      <div className="h-full bg-blue-500" style={{ width: `${workPct}%` }} />
    </div>
  );
}
