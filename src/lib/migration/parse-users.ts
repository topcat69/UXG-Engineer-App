import type { Database } from "@/lib/supabase/database.types";
import { optionalText, parseCsvRows, parseEnum, parseOptionalBoolean, parseOptionalNumber, type ParseResult } from "./csv-helpers";

type UserRole = Database["public"]["Enums"]["user_role"];
const USER_ROLES = ["superadmin", "manager", "engineer"] as const;

/**
 * Deliberately not a `users` table Insert row — `users.id` is a foreign key
 * into `auth.users`, which doesn't exist yet for a migrated user. The
 * migration script creates the real auth user first (via the Supabase
 * Admin Auth API, which is what actually produces a valid `id`), then
 * applies the rest of this row to the `public.users` record the
 * `on_auth_user_created` trigger creates automatically.
 */
export type UserImportRow = {
  email: string;
  name: string;
  role: UserRole;
  company?: string;
  phone?: string;
  active?: boolean;
  max_jobs_per_day?: number;
};

/** Required columns: `email`, `name`. `role` defaults to "engineer", same default the schema itself uses. */
export function parseUsersCsv(text: string): ParseResult<UserImportRow> {
  const { data, errors: parseErrors } = parseCsvRows(text);
  const errors = [...parseErrors];
  const rows: UserImportRow[] = [];
  const seenEmails = new Set<string>();

  data.forEach((raw, index) => {
    const rowNumber = index + 2;
    const email = raw.email?.trim().toLowerCase();
    const name = raw.name?.trim();
    if (!email) {
      errors.push(`Row ${rowNumber}: missing required "email" column`);
      return;
    }
    if (!name) {
      errors.push(`Row ${rowNumber}: missing required "name" column`);
      return;
    }
    if (seenEmails.has(email)) {
      errors.push(`Row ${rowNumber}: duplicate email "${email}" in this file`);
      return;
    }
    seenEmails.add(email);

    const role = parseEnum(raw.role, USER_ROLES, "role", rowNumber, errors) ?? "engineer";

    rows.push({
      email,
      name,
      role,
      company: optionalText(raw.company),
      phone: optionalText(raw.phone),
      active: parseOptionalBoolean(raw.active),
      max_jobs_per_day: parseOptionalNumber(raw.max_jobs_per_day, "max_jobs_per_day", rowNumber, errors),
    });
  });

  return { rows, errors };
}
