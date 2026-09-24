import "server-only";
import { google, type drive_v3 } from "googleapis";
import {
  findOrCreateFolder as findOrCreateFolderImpl,
  uploadFile as uploadFileImpl,
  type DriveFolderClientLike,
  type DriveUploadClientLike,
} from "./drive-folder-logic";

export { type DriveFolderClientLike, type DriveUploadClientLike };

/**
 * One-way, this app → Drive only — same posture as calendar.ts, just a
 * different scope. This client only ever creates folders/files under
 * GOOGLE_DRIVE_ROOT_FOLDER_ID (the "DO NOT USE - Customer Jobs New" folder,
 * renamed from "Customer Jobs New" in Drive — the folder id it's
 * addressed by didn't change, so the rename is cosmetic only — created by
 * hand once under Operations in the Shared Drive per the confirmed
 * scoping); it never reads back anything a human has edited, renamed, or
 * moved. `drive.file` (not the broader `drive`) scope is deliberate: it
 * only grants access to files/folders this service account itself
 * created, which is exactly the access this integration needs and no
 * more — with one catch: GOOGLE_DRIVE_ROOT_FOLDER_ID (the "Customer Jobs
 * New" folder) is created by hand, not by this app, so it must be shared
 * with the service account's client_email as an Editor before anything
 * here works — same precondition as the read-only migrate-media.ts
 * client in drive.ts. Everything below the root, the service account
 * creates itself, so drive.file covers it without any further sharing.
 * Same GOOGLE_SERVICE_ACCOUNT_KEY / GOOGLE_CALENDAR_IMPERSONATE_EMAIL as
 * Calendar, reused rather than provisioning a second credential. Returns
 * null (not a thrown error) only when GOOGLE_SERVICE_ACCOUNT_KEY itself is
 * unconfigured, so callers can treat this as best-effort, same contract
 * as every other integration in this app.
 */
function getDriveFolderClient(): drive_v3.Drive | null {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyJson) return null;
  const impersonate = process.env.GOOGLE_CALENDAR_IMPERSONATE_EMAIL;

  const key = JSON.parse(keyJson) as { client_email: string; private_key: string };
  const auth = new google.auth.JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: ["https://www.googleapis.com/auth/drive.file"],
    subject: impersonate || undefined,
  });
  // Same narrowing cast as getCalendarClient — googleapis's generated
  // Drive type has overloaded call signatures that don't structurally
  // match DriveFolderClientLike's narrow single-call shape; the runtime
  // behavior is compatible since we only ever call the promise form.
  return google.drive({ version: "v3", auth }) as unknown as drive_v3.Drive;
}

/** The pre-created "DO NOT USE - Customer Jobs New" folder everything else nests under. Unset means this integration isn't configured yet. */
function driveRootFolderId(): string | null {
  return process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || null;
}

function driveSharedDriveId(): string | undefined {
  return process.env.GOOGLE_DRIVE_SHARED_DRIVE_ID || undefined;
}

/**
 * Finds or creates a folder named `name` directly under `parentId`.
 * Returns null when Drive isn't configured (no service account key) —
 * best-effort, same contract as syncJobCalendarEvent.
 */
export async function createOrFetchFolder(name: string, parentId: string): Promise<string | null> {
  return findOrCreateFolderImpl(getDriveFolderClient() as unknown as DriveFolderClientLike | null, name, parentId, driveSharedDriveId());
}

/** Returns the "DO NOT USE - Customer Jobs New" root folder id, or null if Drive isn't configured (no key, or no root folder id set). */
export function customerJobsRootFolderId(): string | null {
  if (!getDriveFolderClient()) return null;
  return driveRootFolderId();
}

/**
 * Uploads `content` as a new file named `name` inside `parentId`.
 * Returns null when Drive isn't configured — best-effort, same contract
 * as createOrFetchFolder.
 */
export async function uploadFile(name: string, parentId: string, content: Buffer, mimeType: string): Promise<string | null> {
  return uploadFileImpl(getDriveFolderClient() as unknown as DriveUploadClientLike | null, name, parentId, content, mimeType);
}
