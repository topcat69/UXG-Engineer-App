"use client";

/**
 * Safari evicts script-writable storage (IndexedDB included) under pressure.
 * `navigator.storage.persist()` asks for protection from that — but per
 * PROMPT.md's iOS-constraints section, it only actually succeeds once
 * notification permission has been granted, so the two are requested
 * together with a plain-language reason, during onboarding.
 */
export async function requestPersistentStorage(): Promise<{
  persisted: boolean;
  notificationPermission: NotificationPermission | "unsupported";
}> {
  let notificationPermission: NotificationPermission | "unsupported" = "unsupported";
  if ("Notification" in window) {
    notificationPermission = await Notification.requestPermission();
  }

  let persisted = false;
  if (navigator.storage?.persist) {
    persisted = await navigator.storage.persist();
  }

  return { persisted, notificationPermission };
}

export async function isStoragePersisted(): Promise<boolean> {
  if (!navigator.storage?.persisted) return false;
  return navigator.storage.persisted();
}

export async function estimateStorage(): Promise<{ usageBytes: number; quotaBytes: number } | null> {
  if (!navigator.storage?.estimate) return null;
  const { usage, quota } = await navigator.storage.estimate();
  if (usage === undefined || quota === undefined) return null;
  return { usageBytes: usage, quotaBytes: quota };
}
