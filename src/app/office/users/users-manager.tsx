"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CurrentUser } from "@/lib/auth/current-user";
import type { Database } from "@/lib/supabase/database.types";
import { humanize } from "@/lib/format/text";
import { changeUserRole, createUser, setUserActive, type UserRow } from "./actions";

type UserRole = Database["public"]["Enums"]["user_role"];

const ALL_ROLES: UserRole[] = ["superadmin", "manager", "engineer"];

/** Mirrors the users_write RLS policy client-side, purely to decide what controls to show — the database enforces the real boundary. */
function canManage(actorRole: UserRole, targetRole: UserRole): boolean {
  return actorRole === "superadmin" || (actorRole === "manager" && targetRole === "engineer");
}

/**
 * Users are held in local state, seeded from server props and patched
 * directly from each action's own return value — never router.refresh().
 * Besides this build's RSC refresh lagging one mutation behind under rapid
 * sequential edits (see DECISIONS.md), router.refresh() inside the same
 * startTransition here kept every row's shared `isPending` true well after
 * its own action had resolved, since the transition doesn't settle until
 * the refresh does too — disabling buttons on unrelated rows for however
 * long that refresh took. revalidatePath in each server action already
 * keeps other tabs/next-visits consistent, so it's not load-bearing here.
 */
export function UsersManager({ currentUser, users: initialUsers }: { currentUser: CurrentUser; users: UserRow[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("engineer");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const creatableRoles = currentUser.role === "superadmin" ? ALL_ROLES : (["engineer"] as UserRole[]);

  function handleCreate() {
    startTransition(async () => {
      const result = await createUser(name, email, role);
      if (result.ok) {
        setUsers((prev) => [...prev, result.user].sort((a, b) => a.name.localeCompare(b.name)));
        setName("");
        setEmail("");
        setRole("engineer");
        setMessage(`${result.user.name} added.`);
      } else {
        setMessage(result.message);
      }
    });
  }

  function handleSetActive(userId: string, active: boolean) {
    startTransition(async () => {
      const result = await setUserActive(userId, active);
      if (result.ok) {
        setUsers((prev) => prev.map((u) => (u.id === userId ? result.user : u)));
      } else {
        setMessage(result.message);
      }
    });
  }

  function handleChangeRole(userId: string, newRole: UserRole) {
    startTransition(async () => {
      const result = await changeUserRole(userId, newRole);
      if (result.ok) {
        setUsers((prev) => prev.map((u) => (u.id === userId ? result.user : u)));
      } else {
        setMessage(result.message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2 font-medium">Name</th>
            <th className="py-2 font-medium">Email</th>
            <th className="py-2 font-medium">Role</th>
            <th className="py-2 font-medium">Status</th>
            <th className="py-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const manageable = canManage(currentUser.role, u.role);
            const isSelf = u.id === currentUser.id;
            return (
              <tr key={u.id} className="border-b">
                <td className="py-2">{u.name}</td>
                <td className="py-2 text-muted-foreground">{u.email}</td>
                <td className="py-2">
                  {currentUser.role === "superadmin" ? (
                    <select
                      value={u.role}
                      disabled={isPending}
                      onChange={(e) => handleChangeRole(u.id, e.target.value as UserRole)}
                      className="border-input h-8 rounded-md border bg-transparent px-2 text-sm"
                    >
                      {ALL_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {humanize(r)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Badge variant="secondary">{humanize(u.role)}</Badge>
                  )}
                </td>
                <td className="py-2">
                  <Badge variant={u.active ? "secondary" : "outline"}>{u.active ? "Active" : "Deactivated"}</Badge>
                </td>
                <td className="py-2">
                  {manageable && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isPending || (isSelf && u.active)}
                      title={isSelf && u.active ? "You can't deactivate your own account" : undefined}
                      onClick={() => handleSetActive(u.id, !u.active)}
                    >
                      {u.active ? "Deactivate" : "Reactivate"}
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <section className="flex flex-col gap-3 border-t pt-4">
        <h2 className="font-medium">Add a user</h2>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-muted-foreground text-xs">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-muted-foreground text-xs">Google email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              className="border-input h-9 w-64 rounded-md border bg-transparent px-2 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-muted-foreground text-xs">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
            >
              {creatableRoles.map((r) => (
                <option key={r} value={r}>
                  {humanize(r)}
                </option>
              ))}
            </select>
          </div>
          <Button type="button" onClick={handleCreate} disabled={isPending || !name.trim() || !email.trim()}>
            Add user
          </Button>
        </div>
        {message && <p className="text-muted-foreground text-sm">{message}</p>}
      </section>
    </div>
  );
}
