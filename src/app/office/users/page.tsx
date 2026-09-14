import { requireOfficeUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { UsersManager } from "./users-manager";

export default async function UsersPage() {
  const currentUser = await requireOfficeUser();
  const supabase = await createClient();
  const { data: users } = await supabase
    .from("users")
    .select("id, name, email, role, active, phone, company, max_jobs_per_day, allow_password_login")
    .order("name");

  // Supabase Auth already tracks this on every sign-in (magic link,
  // password, Google) — no need for our own column/instrumentation.
  // perPage covers this app's whole roster in one call; revisit with real
  // pagination if the user count ever approaches it.
  const admin = createAdminClient();
  const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const lastSignInByUserId: Record<string, string | null> = {};
  for (const u of authUsers?.users ?? []) lastSignInByUserId[u.id] = u.last_sign_in_at ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Users</h1>
        <p className="text-muted-foreground text-sm">
          {currentUser.role === "superadmin"
            ? "Manage every account and role."
            : "Manage engineer accounts. Only a superadmin can create or edit manager/superadmin accounts."}
        </p>
      </div>
      <UsersManager currentUser={currentUser} users={users ?? []} lastSignInByUserId={lastSignInByUserId} />
    </div>
  );
}
