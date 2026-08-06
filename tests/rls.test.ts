import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import { adminClient, clientForUser } from "./helpers/rls-test-client";

// Proves the RLS policies in supabase/migrations/20260103000000_rls.sql
// against a real local Postgres + GoTrue instance (no mocks), using the
// exact 3-role seed from supabase/seed.sql: 60 jobs split 20/20/20 across
// {assigned to engineer + in the 30-day/14-day window},
// {assigned to engineer + outside the window}, {unassigned}.

let admin: SupabaseClient<Database>;
let adminUser: SupabaseClient<Database>;
let managerUser: SupabaseClient<Database>;
let engineerUser: SupabaseClient<Database>;
let engineerId: string;

beforeAll(async () => {
  admin = adminClient();
  adminUser = await clientForUser("admin@opoc.test");
  managerUser = await clientForUser("manager@opoc.test");
  engineerUser = await clientForUser("engineer@opoc.test");

  const { data, error } = await admin.from("users").select("id").eq("email", "engineer@opoc.test").single();
  if (error || !data) throw new Error("seed data missing engineer@opoc.test");
  engineerId = data.id;
}, 30_000);

describe("jobs: superadmin", () => {
  it("reads all 60 seeded jobs", async () => {
    const { data, error } = await adminUser.from("jobs").select("id");
    expect(error).toBeNull();
    expect(data).toHaveLength(60);
  });
});

describe("jobs: manager", () => {
  it("reads all 60 seeded jobs", async () => {
    const { data, error } = await managerUser.from("jobs").select("id");
    expect(error).toBeNull();
    expect(data).toHaveLength(60);
  });

  it("can edit an engineer's user row (name), but cannot promote them to manager/superadmin (deliberately failing check)", async () => {
    const { data: before } = await admin.from("users").select("name").eq("email", "engineer@opoc.test").single();

    const { data: renamed, error: renameError } = await managerUser
      .from("users")
      .update({ name: "Eve Engineer (edited by manager)" })
      .eq("email", "engineer@opoc.test")
      .select();
    expect(renameError).toBeNull();
    expect(renamed).toHaveLength(1);
    expect(renamed![0].name).toBe("Eve Engineer (edited by manager)");
    // Revert so later tests relying on the seeded engineer row are unaffected.
    await admin.from("users").update({ name: before!.name }).eq("email", "engineer@opoc.test");

    // A manager's users_write access is scoped to role = 'engineer' rows
    // only, checked on both the existing row (via `using`) and the row
    // being written (via `with check`). This one selects the row fine
    // (using passes — it's still role='engineer' going in) but the
    // attempted new value fails `with check`, and unlike a `using`
    // rejection (silent 0 rows, see the tests above), Postgres raises a
    // hard 42501 error for a `with check` failure on an already-selected
    // row. If this ever silently succeeds instead, a manager could grant
    // themselves or anyone else superadmin.
    const { error: promoteError } = await managerUser
      .from("users")
      .update({ role: "manager" })
      .eq("email", "engineer@opoc.test")
      .select();
    expect(promoteError?.code).toBe("42501");

    const { data: unchanged } = await admin.from("users").select("role").eq("email", "engineer@opoc.test").single();
    expect(unchanged?.role).toBe("engineer");
  });

  it("cannot write another manager's or the superadmin's user row (deliberately failing check)", async () => {
    const { data, error } = await managerUser
      .from("users")
      .update({ name: "hijacked" })
      .eq("email", "admin@opoc.test")
      .select();
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });
});

describe("jobs: engineer", () => {
  it("reads exactly the 20 jobs assigned to them within the scheduling window", async () => {
    const { data, error } = await engineerUser.from("jobs").select("id, assigned_to");
    expect(error).toBeNull();
    expect(data).toHaveLength(20);
    for (const job of data ?? []) {
      expect(job.assigned_to).toBe(engineerId);
    }
  });

  it("cannot read unassigned jobs (deliberately failing check)", async () => {
    const { data, error } = await engineerUser.from("jobs").select("id").is("assigned_to", null);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("cannot read their own jobs scheduled outside the +14 day window (deliberately failing check)", async () => {
    // Seed assigns 20 jobs to the engineer 45 days in the future — outside
    // the window. If the date filter were ever dropped from the policy,
    // the engineer's total visible job count would jump from 20 to 40.
    const { data: outsideWindow } = await admin
      .from("jobs")
      .select("id")
      .eq("assigned_to", engineerId)
      .gt("scheduled_start", new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString());
    expect(outsideWindow!.length).toBeGreaterThan(0);

    const { data: visible } = await engineerUser
      .from("jobs")
      .select("id")
      .in(
        "id",
        (outsideWindow ?? []).map((j) => j.id),
      );
    expect(visible).toHaveLength(0);
  });

  it("cannot escalate their own role (deliberately failing check)", async () => {
    const { data, error } = await engineerUser
      .from("users")
      .update({ role: "superadmin" })
      .eq("id", engineerId)
      .select();
    expect(error).toBeNull();
    expect(data).toHaveLength(0);

    const { data: unchanged } = await admin.from("users").select("role").eq("id", engineerId).single();
    expect(unchanged?.role).toBe("engineer");
  });
});

describe("status_events: append-only for every role", () => {
  it("superadmin can insert a status_event but cannot update or delete it (deliberately failing check)", async () => {
    const { data: job } = await admin.from("jobs").select("id").limit(1).single();

    const { data: inserted, error: insertError } = await adminUser
      .from("status_events")
      .insert({ job_id: job!.id, to_status: "scheduled" })
      .select()
      .single();
    expect(insertError).toBeNull();
    expect(inserted).not.toBeNull();

    // No UPDATE/DELETE policy exists at all for status_events, so these
    // match zero rows rather than erroring — assert on row count, not `error`.
    const { data: updated, error: updateError } = await adminUser
      .from("status_events")
      .update({ reason: "edited after the fact" })
      .eq("id", inserted!.id)
      .select();
    expect(updateError).toBeNull();
    expect(updated).toHaveLength(0);

    const { data: deleted, error: deleteError } = await adminUser
      .from("status_events")
      .delete()
      .eq("id", inserted!.id)
      .select();
    expect(deleteError).toBeNull();
    expect(deleted).toHaveLength(0);

    const { data: stillThere } = await admin.from("status_events").select("reason").eq("id", inserted!.id).single();
    expect(stillThere?.reason).toBeNull();
  });
});

describe("install_forms: evidence lock", () => {
  it("engineer cannot edit a submitted install_form (deliberately failing check)", async () => {
    // Every seeded install_form belongs to a job in a locked status
    // (submitted/under_review/approved/closed), so any one of the 20 proves
    // the point — no need to join back through jobs to find one.
    const { data: form } = await admin.from("install_forms").select("id").limit(1).single();
    expect(form).not.toBeNull();

    const { data: updated, error } = await engineerUser
      .from("install_forms")
      .update({ engineer_notes: "sneaky post-hoc edit" })
      .eq("id", form!.id)
      .select();
    // Denied whether or not this particular job is assigned to the seeded
    // engineer: submitted/under_review/approved/closed are all locked.
    expect(error).toBeNull();
    expect(updated).toHaveLength(0);
  });
});
