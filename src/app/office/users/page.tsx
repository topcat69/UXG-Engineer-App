import { requireOfficeUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { UsersManager } from "./users-manager";

export default async function UsersPage() {
  const currentUser = await requireOfficeUser();
  const supabase = await createClient();
  const { data: users } = await supabase.from("users").select("id, name, email, role, active").order("name");

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
      <UsersManager currentUser={currentUser} users={users ?? []} />
    </div>
  );
}
