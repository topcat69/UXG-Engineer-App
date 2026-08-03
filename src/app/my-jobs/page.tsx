import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";

export default async function MyJobsPlaceholder() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 p-4 text-center">
      <h1 className="text-xl font-semibold">Hi {user.name}</h1>
      <p className="text-muted-foreground max-w-sm">
        The field app (offline job list, forms, photos, signatures) is built in Phase 3. Nothing
        here yet.
      </p>
    </main>
  );
}
