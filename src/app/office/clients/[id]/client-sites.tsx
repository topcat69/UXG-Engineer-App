import Link from "next/link";
import type { SiteRow } from "../../sites/actions";

/**
 * Read-only — a site belongs to exactly one customer but is reusable across
 * all of that customer's projects, so it's created and edited (including
 * reassigning its customer) from /office/sites, not here. Keeping this list
 * read-only is what keeps this page from turning into a second copy of the
 * Sites page crammed in alongside Projects.
 */
export function ClientSites({ sites }: { sites: SiteRow[] }) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="font-medium">Sites</h2>
        <p className="text-muted-foreground text-sm">
          The individual locations this customer&apos;s jobs happen at. Add or edit sites from
          the{" "}
          <Link href="/office/sites" className="underline">
            Sites page
          </Link>
          .
        </p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2 font-medium">Name</th>
            <th className="py-2 font-medium">Store ID</th>
            <th className="py-2 font-medium">Address</th>
          </tr>
        </thead>
        <tbody>
          {sites.map((s) => (
            <tr key={s.id} className="border-b">
              <td className="py-2">{s.name}</td>
              <td className="py-2 text-muted-foreground">{s.store_id || "—"}</td>
              <td className="py-2 text-muted-foreground">
                {[s.address_line1, s.town, s.postcode].filter(Boolean).join(", ") || "—"}
              </td>
            </tr>
          ))}
          {sites.length === 0 && (
            <tr>
              <td colSpan={3} className="text-muted-foreground py-4 text-center">
                No sites yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
