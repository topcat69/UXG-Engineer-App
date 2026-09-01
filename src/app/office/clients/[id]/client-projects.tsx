import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { humanize } from "@/lib/format/text";

type ClientProject = {
  id: string;
  name: string;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
};

/**
 * Read-only — full project CRUD (name/dates/status/client) stays on
 * /office/projects; this just makes the client -> project half of the tree
 * browsable from the client's own page, alongside its Sites below.
 */
export function ClientProjects({ projects }: { projects: ClientProject[] }) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="font-medium">Projects</h2>
        <p className="text-muted-foreground text-sm">
          This client&apos;s projects. Add or edit projects from the{" "}
          <Link href="/office/projects" className="underline">
            Projects page
          </Link>
          .
        </p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2 font-medium">Name</th>
            <th className="py-2 font-medium">Status</th>
            <th className="py-2 font-medium">Dates</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <tr key={p.id} className="border-b">
              <td className="py-2 font-medium">
                <Link href={`/office/jobs?project_id=${p.id}`} className="hover:underline">
                  {p.name}
                </Link>
              </td>
              <td className="py-2">
                <Badge variant="secondary">{humanize(p.status ?? "")}</Badge>
              </td>
              <td className="py-2 text-muted-foreground">
                {[p.start_date, p.end_date].filter(Boolean).join(" – ") || "—"}
              </td>
            </tr>
          ))}
          {projects.length === 0 && (
            <tr>
              <td colSpan={3} className="text-muted-foreground py-4 text-center">
                No projects yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
