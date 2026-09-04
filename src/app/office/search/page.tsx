import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { humanize } from "@/lib/format/text";
import { JOB_TYPE_LABELS } from "@/lib/forms/job-form";

const RESULT_LIMIT = 15;

function param(searchParams: Record<string, string | string[] | undefined>, key: string): string {
  const value = searchParams[key];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

// Strips characters that would break PostgREST's or() filter syntax (comma
// separates conditions, parens group them) — everything else in the term is
// passed through as-is and wildcarded on both sides for an ilike match.
function sanitizeTerm(raw: string): string {
  return raw.replace(/[,()]/g, " ").trim();
}

export default async function OfficeSearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const term = sanitizeTerm(param(sp, "q"));

  if (!term) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold">Search</h1>
        <p className="text-muted-foreground text-sm">
          Enter a search term above to look across customers, projects, sites, and jobs.
        </p>
      </div>
    );
  }

  const supabase = await createClient();
  const like = `%${term}%`;

  const [{ data: clientRows }, { data: projectRows }, { data: siteRows }, { data: jobRows }] = await Promise.all([
    supabase
      .from("clients")
      .select("id, name, contact_name, contact_email")
      .or(`name.ilike.${like},contact_name.ilike.${like},contact_email.ilike.${like}`)
      .order("name")
      .limit(RESULT_LIMIT),
    supabase
      .from("projects")
      .select("id, name, status, client:clients(name)")
      .ilike("name", like)
      .order("name")
      .limit(RESULT_LIMIT),
    supabase
      .from("sites")
      .select("id, name, store_id, town, postcode, client_id, client:clients(name)")
      .or(`name.ilike.${like},store_id.ilike.${like},address_line1.ilike.${like},town.ilike.${like},postcode.ilike.${like}`)
      .order("name")
      .limit(RESULT_LIMIT),
    supabase
      .from("jobs")
      .select("id, job_number, job_type, status, site:sites(name, client:clients(name))")
      .or(`job_number.ilike.${like},description.ilike.${like}`)
      .order("created_at", { ascending: false })
      .limit(RESULT_LIMIT),
  ]);

  const clients = clientRows ?? [];
  const projects = projectRows ?? [];
  const sites = siteRows ?? [];
  const jobs = jobRows ?? [];
  const total = clients.length + projects.length + sites.length + jobs.length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Search results for &quot;{term}&quot;</h1>
        <p className="text-muted-foreground text-sm">
          {total} match{total === 1 ? "" : "es"}
        </p>
      </div>

      {total === 0 && <p className="text-muted-foreground text-sm">No matches. Try a different search term.</p>}

      {clients.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-muted-foreground text-sm font-medium">Customers</h2>
          <div className="flex flex-col divide-y rounded-md border">
            {clients.map((c) => (
              <Link
                key={c.id}
                href={`/office/clients/${c.id}`}
                className="flex items-center justify-between px-3 py-2 text-sm hover:bg-accent"
              >
                <span className="font-medium">{c.name}</span>
                <span className="text-muted-foreground">{[c.contact_name, c.contact_email].filter(Boolean).join(" · ") || "—"}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {projects.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-muted-foreground text-sm font-medium">Projects</h2>
          <div className="flex flex-col divide-y rounded-md border">
            {projects.map((p) => (
              <Link
                key={p.id}
                href={`/office/jobs?project_id=${p.id}`}
                className="flex items-center justify-between px-3 py-2 text-sm hover:bg-accent"
              >
                <span className="font-medium">{p.name}</span>
                <span className="text-muted-foreground flex items-center gap-2">
                  {p.client?.name ?? "No customer"}
                  <Badge variant="secondary">{humanize(p.status ?? "")}</Badge>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {sites.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-muted-foreground text-sm font-medium">Sites</h2>
          <div className="flex flex-col divide-y rounded-md border">
            {sites.map((s) => (
              <Link
                key={s.id}
                href={`/office/clients/${s.client_id}`}
                className="flex items-center justify-between px-3 py-2 text-sm hover:bg-accent"
              >
                <span className="font-medium">
                  {s.name}
                  {s.store_id && <span className="text-muted-foreground"> ({s.store_id})</span>}
                </span>
                <span className="text-muted-foreground">
                  {[s.client?.name, [s.town, s.postcode].filter(Boolean).join(", ") || null].filter(Boolean).join(" · ") || "—"}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {jobs.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-muted-foreground text-sm font-medium">Jobs</h2>
          <div className="flex flex-col divide-y rounded-md border">
            {jobs.map((j) => (
              <Link
                key={j.id}
                href={`/office/jobs/${j.id}`}
                className="flex items-center justify-between px-3 py-2 text-sm hover:bg-accent"
              >
                <span className="font-medium">{j.job_number}</span>
                <span className="text-muted-foreground flex items-center gap-2">
                  {j.site?.client?.name ?? "—"} · {j.site?.name ?? "—"} ·{" "}
                  {JOB_TYPE_LABELS[j.job_type as keyof typeof JOB_TYPE_LABELS] ?? humanize(j.job_type)}
                  <Badge variant="secondary">{humanize(j.status)}</Badge>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
