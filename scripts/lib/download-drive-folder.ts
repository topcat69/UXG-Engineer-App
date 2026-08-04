import fs from "node:fs";
import path from "node:path";
import type { drive_v3 } from "googleapis";

const FOLDER_MIME = "application/vnd.google-apps.folder";

/**
 * Recursively downloads every file under a Drive folder into `destDir`,
 * preserving the folder tree exactly (a Drive subfolder becomes a
 * subdirectory, a file becomes a file with the same name) — so a
 * media.csv manifest written against "JOB-1/before.jpg" paths lines up
 * with what lands on disk, regardless of whether those files got there
 * from Drive or a plain directory copy. Google Docs/Sheets/Slides (no
 * fixed binary export) are skipped with a warning rather than silently
 * dropped, since a photo folder should never contain one, and a native
 * Drive doc there is a sign the folder ID is wrong.
 */
export async function downloadDriveFolderTree(drive: drive_v3.Drive, folderId: string, destDir: string): Promise<string[]> {
  fs.mkdirSync(destDir, { recursive: true });
  const warnings: string[] = [];

  let pageToken: string | undefined;
  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "nextPageToken, files(id, name, mimeType)",
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    for (const file of res.data.files ?? []) {
      if (!file.id || !file.name) continue;

      if (file.mimeType === FOLDER_MIME) {
        warnings.push(...(await downloadDriveFolderTree(drive, file.id, path.join(destDir, file.name))));
        continue;
      }
      if (file.mimeType?.startsWith("application/vnd.google-apps.")) {
        warnings.push(`Skipped native Drive file with no binary export: ${file.name}`);
        continue;
      }

      const destPath = path.join(destDir, file.name);
      const response = await drive.files.get({ fileId: file.id, alt: "media", supportsAllDrives: true }, { responseType: "arraybuffer" });
      fs.writeFileSync(destPath, Buffer.from(response.data as ArrayBuffer));
    }

    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return warnings;
}
