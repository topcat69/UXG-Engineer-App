import { Readable } from "node:stream";

/**
 * Just the shape of googleapis's Drive client this app actually calls,
 * kept separate from the real `googleapis` import so the find-vs-create
 * logic below can be unit tested with a plain fake object instead of
 * mocking the SDK — same split as sync-logic.ts/calendar.ts. drive-folders.ts's
 * `server-only` guard means it can't be imported into a test at all; this
 * file is the part of that logic worth testing in isolation.
 */
export type DriveFolderClientLike = {
  files: {
    list(params: {
      q: string;
      fields: string;
      pageSize: number;
      supportsAllDrives: boolean;
      includeItemsFromAllDrives: boolean;
      corpora: string;
      driveId?: string;
    }): Promise<{ data: { files?: { id?: string | null }[] } }>;
    create(params: {
      requestBody: { name: string; mimeType: string; parents: string[] };
      fields: string;
      supportsAllDrives: boolean;
    }): Promise<{ data: { id?: string | null } }>;
  };
};

/**
 * Finds a folder named exactly `name` directly under `parentId`, creating
 * it if none exists. This is the one primitive every level of the
 * "DO NOT USE - Customer Jobs New" tree (client, project, and — from Phase 2 — site/job)
 * is built from, so "does this folder already exist" only has to be
 * answered correctly once. Name match is exact, not fuzzy — two clients
 * that happen to share a name get two folders, same as they'd get two
 * rows in the clients table. Returns null (not a thrown error) when
 * `drive` itself is null, matching syncEvent's "not configured" branch —
 * callers treat this as best-effort, same contract as Calendar.
 */
export async function findOrCreateFolder(
  drive: DriveFolderClientLike | null,
  name: string,
  parentId: string,
  sharedDriveId?: string,
): Promise<string | null> {
  if (!drive) return null;

  const escaped = name.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const query = `name = '${escaped}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;

  const { data: found } = await drive.files.list({
    q: query,
    fields: "files(id)",
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    corpora: sharedDriveId ? "drive" : "allDrives",
    driveId: sharedDriveId,
  });
  const existingId = found.files?.[0]?.id;
  if (existingId) return existingId;

  const { data: created } = await drive.files.create({
    requestBody: { name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] },
    fields: "id",
    supportsAllDrives: true,
  });
  if (!created.id) throw new Error(`Drive returned no id creating folder "${name}" under ${parentId}`);
  return created.id;
}

/** Just the file-upload call this app actually makes — same split as DriveFolderClientLike above. */
export type DriveUploadClientLike = {
  files: {
    create(params: {
      requestBody: { name: string; parents: string[] };
      media: { mimeType: string; body: Readable };
      fields: string;
      supportsAllDrives: boolean;
    }): Promise<{ data: { id?: string | null } }>;
  };
};

/**
 * Uploads `content` as a new file named `name` inside `parentId`. Always
 * creates — never checked for an existing file with the same name first,
 * unlike findOrCreateFolder — because every caller already guards on its
 * own drive_file_id column being null before calling this, so "does this
 * already exist" was answered by the database, not by asking Drive.
 * Returns null (not a thrown error) when `drive` itself is null, same
 * "not configured" contract as findOrCreateFolder.
 */
export async function uploadFile(
  drive: DriveUploadClientLike | null,
  name: string,
  parentId: string,
  content: Buffer,
  mimeType: string,
): Promise<string | null> {
  if (!drive) return null;

  const { data } = await drive.files.create({
    requestBody: { name, parents: [parentId] },
    media: { mimeType, body: Readable.from(content) },
    fields: "id",
    supportsAllDrives: true,
  });
  if (!data.id) throw new Error(`Drive returned no id uploading file "${name}" to ${parentId}`);
  return data.id;
}
