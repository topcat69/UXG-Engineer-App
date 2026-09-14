"use client";

import { useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}
function getSnapshot() {
  return navigator.onLine;
}
/** SSR has no navigator — "online" is the safe default, corrected immediately on hydration (same pattern as install-prompt.tsx's useIsStandalone/useIsIOS). */
function getServerSnapshot() {
  return true;
}

/** Shared by every field-app screen that's online-only (Knowledge Base, Help) rather than going through Dexie/the offline outbox like the rest of the app. */
export function useIsOnline(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
