/** Shared by the Asset Register's report pages (depreciation, financial, warranty) — a plain summary number, not the dashboard's clickable drill-through StatTile. */
export function StatTile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border p-4">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
      {detail && <span className="text-muted-foreground text-xs">{detail}</span>}
    </div>
  );
}
