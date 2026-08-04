#!/usr/bin/env tsx
/**
 * One-time AppSheet data migration. Usage:
 *
 *   pnpm migrate:appsheet <path-to-export-directory>
 *
 * The directory may contain any subset of: users.csv, projects.csv,
 * sites.csv, assets.csv, jobs.csv, install_forms.csv, survey_forms.csv,
 * issues.csv — column shapes match this app's own schema (see
 * DECISIONS.md's Phase 7 section for why, and the exact expected headers).
 */
import { createScriptAdminClient } from "./lib/supabase-admin";
import { runMigration } from "./lib/run-migration";

async function main() {
  const dir = process.argv[2];
  if (!dir) {
    console.error("Usage: pnpm migrate:appsheet <path-to-export-directory>");
    process.exit(1);
  }

  const supabase = createScriptAdminClient();
  const { counts, errors } = await runMigration(dir, supabase);

  console.log("Imported:");
  for (const [table, count] of Object.entries(counts)) {
    console.log(`  ${table}: ${count}`);
  }

  if (errors.length > 0) {
    console.error(`\n${errors.length} row(s) skipped:`);
    for (const e of errors) console.error(`  ${e}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
