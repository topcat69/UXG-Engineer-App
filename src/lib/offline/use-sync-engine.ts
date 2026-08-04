"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { drainMediaQueue, drainOutbox } from "./outbox";
import { syncDown } from "./sync-down";

const RETRY_INTERVAL_MS = 30_000;

/**
 * The foreground retry loop, per PROMPT.md's iOS-constraints section: Safari
 * has no Background Sync API, so this — run on app open, on
 * visibilitychange, on network reconnect, and on a timer while open — is
 * the baseline that has to work everywhere, not a fallback. (Background
 * Sync as a progressive Android enhancement is deliberately not built here;
 * see DECISIONS.md for why.)
 */
export function useSyncEngine(userId: string | null) {
  const [isSyncing, setIsSyncing] = useState(false);
  const runningRef = useRef(false);
  // If a caller (e.g. a manual "Retry now" tap) asks to sync while a run is
  // already in flight, don't just drop the request — queue exactly one more
  // pass so the tap still does something once the current run finishes.
  const rerunRequestedRef = useRef(false);

  const runSync = useCallback(async () => {
    if (!userId) return;
    if (runningRef.current) {
      rerunRequestedRef.current = true;
      return;
    }
    runningRef.current = true;
    setIsSyncing(true);
    try {
      do {
        rerunRequestedRef.current = false;
        await drainOutbox();
        await drainMediaQueue();
        if (navigator.onLine) {
          await syncDown(userId);
        }
      } while (rerunRequestedRef.current);
    } catch (error) {
      console.error("sync failed", error);
    } finally {
      runningRef.current = false;
      setIsSyncing(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    runSync();

    const onVisibility = () => {
      if (document.visibilityState === "visible") runSync();
    };
    const onOnline = () => runSync();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    const interval = setInterval(runSync, RETRY_INTERVAL_MS);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
      clearInterval(interval);
    };
  }, [userId, runSync]);

  return { isSyncing, runSync };
}
