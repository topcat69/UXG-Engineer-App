"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CurrentUser } from "@/lib/auth/current-user";
import type { Database } from "@/lib/supabase/database.types";
import { humanize } from "@/lib/format/text";
import {
  changeUserRole,
  createUser,
  deleteUser,
  disablePasswordLogin,
  setUserActive,
  setUserPassword,
  updateUser,
  type UserRow,
} from "./actions";

type UserRole = Database["public"]["Enums"]["user_role"];

const ALL_ROLES: UserRole[] = ["superadmin", "manager", "engineer", "warehouse"];

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

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editCompany, setEditCompany] = useState("");
  const [editMaxJobsPerDay, setEditMaxJobsPerDay] = useState("");

  const [passwordUserId, setPasswordUserId] = useState<string | null>(null);
  const [passwordValue, setPasswordValue] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

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

  function handleDelete(u: UserRow) {
    if (!window.confirm(`Delete ${u.name}'s account? This can't be undone. Only works for an account with no job history at all — if they've ever been assigned a job, raised an issue, or had a status update, this will fail (deactivating is the correct way to remove someone with real history).`))
      return;
    startTransition(async () => {
      const result = await deleteUser(u.id);
      if (result.ok) {
        setUsers((prev) => prev.filter((row) => row.id !== u.id));
      } else {
        setMessage(result.message);
      }
    });
  }

  function handleStartEdit(u: UserRow) {
    setEditingUserId(u.id);
    setEditName(u.name);
    setEditEmail(u.email);
    setEditPhone(u.phone ?? "");
    setEditCompany(u.company ?? "");
    setEditMaxJobsPerDay(u.max_jobs_per_day == null ? "" : String(u.max_jobs_per_day));
    setMessage(null);
  }

  function handleCancelEdit() {
    setEditingUserId(null);
  }

  function handleStartPassword(userId: string) {
    setPasswordUserId(userId);
    setPasswordValue("");
    setPasswordConfirm("");
    setMessage(null);
  }

  function handleCancelPassword() {
    setPasswordUserId(null);
  }

  function handleSavePassword() {
    if (!passwordUserId) return;
    if (passwordValue !== passwordConfirm) {
      setMessage("Passwords don't match.");
      return;
    }
    const userId = passwordUserId;
    startTransition(async () => {
      const result = await setUserPassword(userId, passwordValue);
      if (result.ok) {
        setUsers((prev) => prev.map((u) => (u.id === userId ? result.user : u)));
        setPasswordUserId(null);
        setMessage(`Password set for ${result.user.name} — they can now sign in with email + password.`);
      } else {
        setMessage(result.message);
      }
    });
  }

  function handleDisablePassword(u: UserRow) {
    if (!window.confirm(`Turn off password sign-in for ${u.name}? They'll need Google sign-in (or a new password) to get back in.`)) return;
    startTransition(async () => {
      const result = await disablePasswordLogin(u.id);
      if (result.ok) {
        setUsers((prev) => prev.map((row) => (row.id === u.id ? result.user : row)));
      } else {
        setMessage(result.message);
      }
    });
  }

  function handleSaveEdit() {
    if (!editingUserId) return;
    const userId = editingUserId;
    startTransition(async () => {
      const result = await updateUser(userId, {
        name: editName,
        email: editEmail,
        phone: editPhone,
        company: editCompany,
        max_jobs_per_day: editMaxJobsPerDay.trim() === "" ? null : Number(editMaxJobsPerDay),
      });
      if (result.ok) {
        setUsers((prev) => prev.map((u) => (u.id === userId ? result.user : u)).sort((a, b) => a.name.localeCompare(b.name)));
        setEditingUserId(null);
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
            <th className="py-2 font-medium">Sign-in</th>
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
                  {currentUser.role === "superadmin" ? (
                    <div className="flex items-center gap-2">
                      <Badge variant={u.allow_password_login ? "secondary" : "outline"}>
                        {u.allow_password_login ? "Password" : "Google only"}
                      </Badge>
                      <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => handleStartPassword(u.id)}>
                        {u.allow_password_login ? "Reset" : "Set password"}
                      </Button>
                      {u.allow_password_login && (
                        <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => handleDisablePassword(u)}>
                          Turn off
                        </Button>
                      )}
                    </div>
                  ) : (
                    <Badge variant={u.allow_password_login ? "secondary" : "outline"}>
                      {u.allow_password_login ? "Password" : "Google only"}
                    </Badge>
                  )}
                </td>
                <td className="py-2">
                  {manageable && (
                    <div className="flex gap-2">
                      <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={() => handleStartEdit(u)}>
                        Edit
                      </Button>
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
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isPending || isSelf}
                        title={isSelf ? "You can't delete your own account" : undefined}
                        onClick={() => handleDelete(u)}
                      >
                        Delete
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {passwordUserId && (
        <section className="flex flex-col gap-3 rounded-md border p-3">
          <h2 className="font-medium">Set password for {users.find((u) => u.id === passwordUserId)?.name}</h2>
          <p className="text-muted-foreground text-xs">
            For an account with no Google Workspace seat — a 3rd-party contractor, or a shared kiosk login. They&apos;ll
            sign in with their email and this password instead of Google.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-muted-foreground text-xs">New password</label>
              <input
                type="password"
                value={passwordValue}
                onChange={(e) => setPasswordValue(e.target.value)}
                autoComplete="new-password"
                className="border-input h-9 w-48 rounded-md border bg-transparent px-2 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-muted-foreground text-xs">Confirm</label>
              <input
                type="password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                autoComplete="new-password"
                className="border-input h-9 w-48 rounded-md border bg-transparent px-2 text-sm"
              />
            </div>
            <Button type="button" disabled={isPending || passwordValue.length < 8} onClick={handleSavePassword}>
              Save password
            </Button>
            <Button type="button" variant="outline" disabled={isPending} onClick={handleCancelPassword}>
              Cancel
            </Button>
          </div>
        </section>
      )}

      {editingUserId && (
        <section className="flex flex-col gap-3 rounded-md border p-3">
          <h2 className="font-medium">Edit {users.find((u) => u.id === editingUserId)?.name}</h2>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-muted-foreground text-xs">Name</label>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-muted-foreground text-xs">Email</label>
              <input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="border-input h-9 w-64 rounded-md border bg-transparent px-2 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-muted-foreground text-xs">Phone</label>
              <input
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-muted-foreground text-xs">Company</label>
              <input
                value={editCompany}
                onChange={(e) => setEditCompany(e.target.value)}
                className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-muted-foreground text-xs">Max jobs/day</label>
              <input
                type="number"
                min={0}
                value={editMaxJobsPerDay}
                onChange={(e) => setEditMaxJobsPerDay(e.target.value)}
                className="border-input h-9 w-24 rounded-md border bg-transparent px-2 text-sm"
              />
            </div>
            <Button type="button" disabled={isPending || !editName.trim() || !editEmail.trim()} onClick={handleSaveEdit}>
              Save
            </Button>
            <Button type="button" variant="outline" disabled={isPending} onClick={handleCancelEdit}>
              Cancel
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            Changing the email also updates their sign-in address — they&apos;ll need to use the new one next time.
          </p>
        </section>
      )}

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
