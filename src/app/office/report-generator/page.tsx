import Link from "next/link";

const REPORTS = [
  {
    href: "/office/reports/sla-compliance",
    title: "SLA Compliance",
    description:
      "Met/breached/open across every SLA job, filterable by client, site, fixture type, reason, engineer, or project — with PDF, Excel, CSV, and zip export.",
  },
  {
    href: "/office/reports/project-rollup",
    title: "Project Rollup",
    description:
      "Cross-job view of a single project, or every project belonging to one customer rolled up together — status, throughput, time, and issues — with PDF, Excel, CSV, and zip export.",
  },
];

/**
 * Report Generator's own top-level landing page — deliberately separate
 * from Completed Jobs (the existing per-job PDF/zip pull at
 * /office/reports), per the confirmed nav decision: jobs stay their own
 * thing, this is where the cross-job/aggregate reports live and grow as
 * more are added (see the Report Generator Blueprint's Phase 2/3
 * candidates). Same "index page linking to its sub-reports" shape as
 * /office/asset-register, just at the top level of the nav instead of
 * tucked under Admin Tools.
 */
export default function ReportGeneratorPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Report Generator</h1>
        <p className="text-muted-foreground text-sm">
          Cross-job reports, run on demand across any accessible client, site, project, or engineer.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {REPORTS.map((report) => (
          <Link
            key={report.href}
            href={report.href}
            className="flex flex-col gap-2 rounded-md border p-4 hover:bg-accent"
          >
            <h2 className="font-medium">{report.title}</h2>
            <p className="text-muted-foreground text-sm">{report.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
