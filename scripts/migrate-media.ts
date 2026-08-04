#!/usr/bin/env tsx
/**
 * Copies job media into Supabase Storage and creates media_assets rows,
 * with metadata (GPS, captured_at, caption) preserved from a media.csv
 * manifest. Usage:
 *
 *   pnpm migrate:media <target-dir>
 *   pnpm migrate:media <target-dir> --drive-folder=<driveFolderId>
 *
 * `<target-dir>` must contain media.csv (see
 * src/lib/migration/parse-media-manifest.ts for its columns) and, unless
 * --drive-folder is given, the media files themselves at the paths
 * media.csv's `filename` column points to.
 *
 * With --drive-folder, files are downloaded from that Drive folder tree
 * into <target-dir> first (requires GOOGLE_SERVICE_ACCOUNT_KEY and
 * GOOGLE_CALENDAR_IMPERSONATE_EMAIL — see DECISIONS.md's Phase 7 section
 * for why this reuses the Calendar service account). media.csv itself
 * must still be placed in <target-dir> beforehand — it's the AppSheet
 * Photos-table export, not something Drive's file tree carries.
 *
 * Run after migrate-appsheet.ts (or against an already-populated
 * database) — job_number -> job_id and email -> user_id lookups come from
 * the live database, not from CSVs.
 */
import { getDriveClient } from "@/lib/google/drive";
import { downloadDriveFolderTree } from "./lib/download-drive-folder";
import { buildJobLookup, buildUserLookup } from "./lib/db-lookups";
import { importMediaFromManifest } from "./lib/media-import";
import { createScriptAdminClient } from "./lib/supabase-admin";

async function main() {
  const targetDir = process.argv[2];
  const driveFlag = process.argv.find((a) => a.startsWith("--drive-folder="));
  if (!targetDir) {
    console.error("Usage: pnpm migrate:media <target-dir> [--drive-folder=<driveFolderId>]");
    process.exit(1);
  }

  if (driveFlag) {
    const folderId = driveFlag.split("=")[1];
    const drive = getDriveClient();
    if (!drive) {
      console.error(
        "GOOGLE_SERVICE_ACCOUNT_KEY / GOOGLE_CALENDAR_IMPERSONATE_EMAIL not configured — " +
          "either set them, or download the Drive folder yourself and pass a plain <target-dir> without --drive-folder.",
      );
      process.exit(1);
    }
    console.log(`Downloading Drive folder ${folderId} into ${targetDir} ...`);
    const warnings = await downloadDriveFolderTree(drive, folderId, targetDir);
    for (const w of warnings) console.warn(`  ${w}`);
  }

  const supabase = createScriptAdminClient();
  const [jobLookup, userLookup] = await Promise.all([buildJobLookup(supabase), buildUserLookup(supabase)]);

  const { imported, errors } = await importMediaFromManifest(targetDir, supabase, jobLookup, userLookup);

  console.log(`Imported ${imported} media file(s).`);
  if (errors.length > 0) {
    console.error(`\n${errors.length} row(s) skipped:`);
    for (const e of errors) console.error(`  ${e}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("Media migration failed:", err);
  process.exit(1);
});
