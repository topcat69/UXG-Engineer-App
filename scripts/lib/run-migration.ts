import fs from "node:fs";
import path from "node:path";
import { buildLookup } from "@/lib/migration/csv-helpers";
import { parseAssetsCsv, resolveAssetRows } from "@/lib/migration/parse-assets";
import { parseInstallFormsCsv, resolveInstallFormRows } from "@/lib/migration/parse-install-forms";
import { parseIssuesCsv, resolveIssueRows } from "@/lib/migration/parse-issues";
import { parseJobsCsv, resolveJobRows } from "@/lib/migration/parse-jobs";
import { parseProjectsCsv } from "@/lib/migration/parse-projects";
import { parseSitesCsv } from "@/lib/csv/sites";
import { parseSurveyFormsCsv, resolveSurveyFormRows } from "@/lib/migration/parse-survey-forms";
import { parseUsersCsv } from "@/lib/migration/parse-users";
import type { ScriptAdminClient } from "./supabase-admin";

export type MigrationSummary = {
  counts: Record<string, number>;
  errors: string[];
};

function readIfExists(dir: string, filename: string): string | null {
  const filePath = path.join(dir, filename);
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8") : null;
}

/**
 * Runs the full AppSheet-export import against `dir` (expected to contain
 * some subset of users.csv, projects.csv, sites.csv, assets.csv, jobs.csv,
 * install_forms.csv, survey_forms.csv, issues.csv — every file is
 * optional, since not every AppSheet app exports every table). Tables are
 * imported in dependency order; each stage's natural-key lookup (email,
 * site/project name, job_number) feeds the next.
 *
 * Meant to run once against an empty(ish) target database — re-running it
 * against data it already imported will create duplicate projects/jobs/etc
 * rather than upserting, since the source schema has no natural unique key
 * on most tables to upsert against. That's an accepted limitation of a
 * one-time migration tool, not a bug to route around with speculative
 * upsert logic for a scenario (repeat migration of the same export) that
 * doesn't actually happen in practice.
 */
export async function runMigration(dir: string, supabase: ScriptAdminClient): Promise<MigrationSummary> {
  const counts: Record<string, number> = {};
  const errors: string[] = [];

  // --- users: each row needs a real auth.users identity before the
  // public.users row (created by the on_auth_user_created trigger) can be
  // updated with the imported profile fields. Idempotent by email, so a
  // partially-failed run can be safely retried.
  const userLookupEntries: { key: string; id: string }[] = [];
  const usersCsv = readIfExists(dir, "users.csv");
  if (usersCsv) {
    const { rows, errors: parseErrors } = parseUsersCsv(usersCsv);
    errors.push(...parseErrors.map((e) => `users.csv: ${e}`));
    let imported = 0;
    for (const row of rows) {
      const { data: existing } = await supabase.from("users").select("id").eq("email", row.email).maybeSingle();
      let userId = existing?.id;
      if (!userId) {
        const { data: created, error: createError } = await supabase.auth.admin.createUser({
          email: row.email,
          email_confirm: true,
          user_metadata: { name: row.name },
        });
        if (createError || !created.user) {
          errors.push(`users.csv: failed to create ${row.email}: ${createError?.message ?? "unknown error"}`);
          continue;
        }
        userId = created.user.id;
      }
      const { error: updateError } = await supabase
        .from("users")
        .update({
          name: row.name,
          role: row.role,
          company: row.company,
          phone: row.phone,
          active: row.active ?? true,
          max_jobs_per_day: row.max_jobs_per_day,
        })
        .eq("id", userId);
      if (updateError) {
        errors.push(`users.csv: failed to update profile for ${row.email}: ${updateError.message}`);
        continue;
      }
      userLookupEntries.push({ key: row.email, id: userId });
      imported++;
    }
    counts.users = imported;
  }
  const userLookup = buildLookup(userLookupEntries);

  // --- projects (no foreign keys)
  const projectLookupEntries: { key: string; id: string }[] = [];
  const projectsCsv = readIfExists(dir, "projects.csv");
  if (projectsCsv) {
    const { rows, errors: parseErrors } = parseProjectsCsv(projectsCsv);
    errors.push(...parseErrors.map((e) => `projects.csv: ${e}`));
    if (rows.length > 0) {
      const { data, error } = await supabase.from("projects").insert(rows).select("id, name");
      if (error) {
        errors.push(`projects.csv: insert failed: ${error.message}`);
      } else {
        counts.projects = data.length;
        for (const p of data) projectLookupEntries.push({ key: p.name, id: p.id });
      }
    }
  }
  const projectLookup = buildLookup(projectLookupEntries);

  // --- sites (no foreign keys) — reuses the same parser as the office CSV import wizard.
  const siteLookupEntries: { key: string; id: string }[] = [];
  const sitesCsv = readIfExists(dir, "sites.csv");
  if (sitesCsv) {
    const { rows, errors: parseErrors } = parseSitesCsv(sitesCsv);
    errors.push(...parseErrors.map((e) => `sites.csv: ${e}`));
    if (rows.length > 0) {
      const { data, error } = await supabase.from("sites").insert(rows).select("id, name");
      if (error) {
        errors.push(`sites.csv: insert failed: ${error.message}`);
      } else {
        counts.sites = data.length;
        for (const s of data) siteLookupEntries.push({ key: s.name, id: s.id });
      }
    }
  }
  const siteLookup = buildLookup(siteLookupEntries);

  // --- assets (site_id, nullable)
  const assetsCsv = readIfExists(dir, "assets.csv");
  if (assetsCsv) {
    const { rows: parsed, errors: parseErrors } = parseAssetsCsv(assetsCsv);
    errors.push(...parseErrors.map((e) => `assets.csv: ${e}`));
    const { rows, errors: resolveErrors } = resolveAssetRows(parsed, siteLookup);
    errors.push(...resolveErrors.map((e) => `assets.csv: ${e}`));
    if (rows.length > 0) {
      const { data, error } = await supabase.from("assets").insert(rows).select("id");
      if (error) errors.push(`assets.csv: insert failed: ${error.message}`);
      else counts.assets = data.length;
    }
  }

  // --- jobs (site_id required; project_id/assigned_to optional) — plus a
  // synthetic status_events row per job to preserve *some* audit trail.
  // AppSheet's own export is a snapshot of current state, not a full change
  // log, so this can't reconstruct real history — it records provenance
  // (imported, at what status) rather than fabricating one.
  const jobLookupEntries: { key: string; id: string }[] = [];
  const jobsCsv = readIfExists(dir, "jobs.csv");
  if (jobsCsv) {
    const { rows: parsed, errors: parseErrors } = parseJobsCsv(jobsCsv);
    errors.push(...parseErrors.map((e) => `jobs.csv: ${e}`));
    const { rows, errors: resolveErrors } = resolveJobRows(parsed, siteLookup, projectLookup, userLookup);
    errors.push(...resolveErrors.map((e) => `jobs.csv: ${e}`));
    if (rows.length > 0) {
      const { data, error } = await supabase.from("jobs").insert(rows).select("id, job_number, status, created_at");
      if (error) {
        errors.push(`jobs.csv: insert failed: ${error.message}`);
      } else {
        counts.jobs = data.length;
        for (const j of data) jobLookupEntries.push({ key: j.job_number, id: j.id });

        const statusEvents = data.map((j) => ({
          job_id: j.id,
          from_status: null,
          to_status: j.status,
          reason: "Migrated from AppSheet import",
          occurred_at: j.created_at ?? new Date().toISOString(),
        }));
        const { error: eventsError } = await supabase.from("status_events").insert(statusEvents);
        if (eventsError) errors.push(`jobs.csv: failed to record migration status_events: ${eventsError.message}`);
      }
    }
  }
  const jobLookup = buildLookup(jobLookupEntries);

  // --- install_forms / survey_forms (job_id, one row per job)
  const installFormsCsv = readIfExists(dir, "install_forms.csv");
  if (installFormsCsv) {
    const { rows: parsed, errors: parseErrors } = parseInstallFormsCsv(installFormsCsv);
    errors.push(...parseErrors.map((e) => `install_forms.csv: ${e}`));
    const { rows, errors: resolveErrors } = resolveInstallFormRows(parsed, jobLookup);
    errors.push(...resolveErrors.map((e) => `install_forms.csv: ${e}`));
    if (rows.length > 0) {
      const { data, error } = await supabase.from("install_forms").insert(rows).select("id");
      if (error) errors.push(`install_forms.csv: insert failed: ${error.message}`);
      else counts.install_forms = data.length;
    }
  }

  const surveyFormsCsv = readIfExists(dir, "survey_forms.csv");
  if (surveyFormsCsv) {
    const { rows: parsed, errors: parseErrors } = parseSurveyFormsCsv(surveyFormsCsv);
    errors.push(...parseErrors.map((e) => `survey_forms.csv: ${e}`));
    const { rows, errors: resolveErrors } = resolveSurveyFormRows(parsed, jobLookup);
    errors.push(...resolveErrors.map((e) => `survey_forms.csv: ${e}`));
    if (rows.length > 0) {
      const { data, error } = await supabase.from("survey_forms").insert(rows).select("id");
      if (error) errors.push(`survey_forms.csv: insert failed: ${error.message}`);
      else counts.survey_forms = data.length;
    }
  }

  // --- issues (job_id/site_id/raised_by all optional)
  const issuesCsv = readIfExists(dir, "issues.csv");
  if (issuesCsv) {
    const { rows: parsed, errors: parseErrors } = parseIssuesCsv(issuesCsv);
    errors.push(...parseErrors.map((e) => `issues.csv: ${e}`));
    const { rows, errors: resolveErrors } = resolveIssueRows(parsed, jobLookup, siteLookup, userLookup);
    errors.push(...resolveErrors.map((e) => `issues.csv: ${e}`));
    if (rows.length > 0) {
      const { data, error } = await supabase.from("issues").insert(rows).select("id");
      if (error) errors.push(`issues.csv: insert failed: ${error.message}`);
      else counts.issues = data.length;
    }
  }

  return { counts, errors };
}
