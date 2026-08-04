import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { FieldApp } from "@/components/field/field-app";

// This is the field app's ONLY route. Everything inside it — job list, job
// workflow, the outbox screen — is client-side view state, not separate
// Next.js routes. That's deliberate: App Router soft-navigation fetches a
// per-URL RSC payload over the network, which would fail offline for any
// route not already cached. One page, cached once after the first online
// visit (see public/sw.js), means the whole offline workflow never depends
// on a second network round trip to the Next.js server.
export default async function MyJobsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <FieldApp user={user} />;
}
