import { describe, expect, it, vi } from "vitest";
import { findOrCreateFolder, uploadFile, type DriveFolderClientLike, type DriveUploadClientLike } from "./drive-folder-logic";

function fakeDrive(existingId: string | null): DriveFolderClientLike {
  return {
    files: {
      list: vi.fn().mockResolvedValue({ data: { files: existingId ? [{ id: existingId }] : [] } }),
      create: vi.fn().mockResolvedValue({ data: { id: "new-folder-id" } }),
    },
  };
}

describe("findOrCreateFolder", () => {
  it("skips without calling the API when Drive isn't configured (null client)", async () => {
    const result = await findOrCreateFolder(null, "Acme Retail", "root-id");
    expect(result).toBeNull();
  });

  it("returns the existing folder's id (never creates a second one) when a folder with that name already exists under the parent", async () => {
    const drive = fakeDrive("existing-folder-id");
    const result = await findOrCreateFolder(drive, "Acme Retail", "root-id");

    expect(drive.files.create).not.toHaveBeenCalled();
    expect(result).toBe("existing-folder-id");
  });

  it("creates a new folder under the parent when none exists yet", async () => {
    const drive = fakeDrive(null);
    const result = await findOrCreateFolder(drive, "Acme Retail", "root-id");

    expect(drive.files.create).toHaveBeenCalledOnce();
    expect(drive.files.create).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: { name: "Acme Retail", mimeType: "application/vnd.google-apps.folder", parents: ["root-id"] },
      }),
    );
    expect(result).toBe("new-folder-id");
  });

  it("scopes the lookup to a specific Shared Drive when one is given", async () => {
    const drive = fakeDrive(null);
    await findOrCreateFolder(drive, "Acme Retail", "root-id", "shared-drive-id");

    expect(drive.files.list).toHaveBeenCalledWith(expect.objectContaining({ corpora: "drive", driveId: "shared-drive-id" }));
  });

  it("escapes single quotes in the folder name so the Drive query stays well-formed", async () => {
    const drive = fakeDrive(null);
    await findOrCreateFolder(drive, "O'Brien's Retail", "root-id");

    expect(drive.files.list).toHaveBeenCalledWith(expect.objectContaining({ q: expect.stringContaining("O\\'Brien\\'s Retail") }));
  });

  it("throws when Drive creates a folder but returns no id", async () => {
    const drive = fakeDrive(null);
    (drive.files.create as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });

    await expect(findOrCreateFolder(drive, "Acme Retail", "root-id")).rejects.toThrow(/no id/);
  });
});

function fakeUploadDrive(): DriveUploadClientLike {
  return {
    files: {
      create: vi.fn().mockResolvedValue({ data: { id: "new-file-id" } }),
    },
  };
}

describe("uploadFile", () => {
  it("skips without calling the API when Drive isn't configured (null client)", async () => {
    const result = await uploadFile(null, "photo.jpg", "job-folder-id", Buffer.from("data"), "image/jpeg");
    expect(result).toBeNull();
  });

  it("uploads the content as a new file under the parent and returns its id", async () => {
    const drive = fakeUploadDrive();
    const content = Buffer.from("photo bytes");
    const result = await uploadFile(drive, "photo.jpg", "job-folder-id", content, "image/jpeg");

    expect(drive.files.create).toHaveBeenCalledOnce();
    expect(drive.files.create).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: { name: "photo.jpg", parents: ["job-folder-id"] },
        media: expect.objectContaining({ mimeType: "image/jpeg" }),
      }),
    );
    expect(result).toBe("new-file-id");
  });

  it("throws when Drive uploads a file but returns no id", async () => {
    const drive = fakeUploadDrive();
    (drive.files.create as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });

    await expect(uploadFile(drive, "photo.jpg", "job-folder-id", Buffer.from("data"), "image/jpeg")).rejects.toThrow(/no id/);
  });
});
