import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { createAdminClient } from "@/lib/supabase/admin";
import { isShareLinkValid } from "@/lib/share-links/validity";

const INSTALL_PHOTO_SLOTS = [
  "photo_before",
  "photo_screen_mounted",
  "photo_player_installed",
  "photo_cable_management",
  "photo_content_on_screen",
  "photo_wide_shot",
];

const SIGNED_URL_TTL_SECONDS = 60 * 60;

/**
 * Public — no account, no Supabase auth (see proxy.ts's PUBLIC_PATHS). Uses
 * the admin client deliberately: share_links has no SELECT policy for
 * anon/authenticated (see 20260111000000_share_links_select.sql), and this
 * route establishes its own authorization via the token itself rather than
 * RLS. Shows only status, basic job/site identification, and — once QA has
 * approved the job — photos. Never qa_notes, engineer_notes, issues, other
 * jobs, or anything cost-related, per spec ("leaks nothing beyond that job").
 */
export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createAdminClient();

  const { data: link } = await supabase
    .from("share_links")
    .select("revoked, expires_at, job_id")
    .eq("token", token)
    .maybeSingle();

  if (!link || !link.job_id || !isShareLinkValid(link, new Date().toISOString())) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-2 p-6 text-center">
        <h1 className="text-lg font-semibold">Link not available</h1>
        <p className="text-muted-foreground text-sm">This link has expired or was revoked.</p>
      </main>
    );
  }

  const { data: job } = await supabase
    .from("jobs")
    .select("job_number, job_type, status, qa_status, scheduled_start, completion_pdf_url, site:sites(name)")
    .eq("id", link.job_id)
    .single();
  if (!job) notFound();

  let reportUrl: string | null = null;
  if (job.completion_pdf_url) {
    const { data } = await supabase.storage.from("media").createSignedUrl(job.completion_pdf_url, SIGNED_URL_TTL_SECONDS);
    reportUrl = data?.signedUrl ?? null;
  }

  let photos: { slot: string; url: string }[] = [];
  if (job.qa_status === "approved" && job.job_type === "install") {
    const { data: media } = await supabase
      .from("media_assets")
      .select("slot, storage_path")
      .eq("job_id", link.job_id)
      .in("slot", INSTALL_PHOTO_SLOTS);

    const signed = await Promise.all(
      (media ?? []).map(async (asset) => {
        const { data } = await supabase.storage.from("media").createSignedUrl(asset.storage_path, SIGNED_URL_TTL_SECONDS);
        return data ? { slot: asset.slot, url: data.signedUrl } : null;
      }),
    );
    photos = signed.filter((p): p is { slot: string; url: string } => !!p);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">{job.job_number}</h1>
        <p className="text-muted-foreground text-sm">{job.site?.name}</p>
      </div>

      <div className="flex items-center gap-2">
        <Badge variant="secondary">{job.status}</Badge>
        {job.scheduled_start && (
          <span className="text-muted-foreground text-sm">{new Date(job.scheduled_start).toLocaleDateString()}</span>
        )}
      </div>

      {job.qa_status === "approved" ? (
        <>
          {reportUrl && (
            <a
              href={reportUrl}
              className="border-input w-fit rounded-md border px-3 py-1.5 text-sm underline hover:bg-accent"
            >
              Download completion report (PDF)
            </a>
          )}
          {photos.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="font-medium">Completion photos</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {photos.map((photo) => (
                  // eslint-disable-next-line @next/next/no-img-element -- signed, time-limited URLs; not worth Next/Image's remote-pattern config for a public one-off page.
                  <img
                    key={photo.slot}
                    src={photo.url}
                    alt={photo.slot.replace("photo_", "").replace(/_/g, " ")}
                    className="aspect-square rounded-md border object-cover"
                  />
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        <p className="text-muted-foreground text-sm">The completion report will appear here once this job passes QA.</p>
      )}
    </main>
  );
}
