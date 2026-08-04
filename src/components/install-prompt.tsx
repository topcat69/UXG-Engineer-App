"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // Safari's own non-standard flag — matchMedia above doesn't cover iOS.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

// These don't change during a session, so a no-op subscribe is fine — the
// point of useSyncExternalStore here is purely to read a browser-only value
// without a client/server hydration mismatch (server snapshot below is the
// safe "hide the banner" default).
const noopSubscribe = () => () => {};

function useIsStandalone(): boolean {
  return useSyncExternalStore(noopSubscribe, isStandalone, () => true);
}

function useIsIOS(): boolean {
  return useSyncExternalStore(noopSubscribe, isIOS, () => false);
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const standalone = useIsStandalone();
  const ios = useIsIOS();

  useEffect(() => {
    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  if (standalone || dismissed) return null;

  if (deferredPrompt) {
    return (
      <div className="flex items-center justify-between gap-3 border-b bg-muted/40 px-4 py-2 text-sm">
        <span>Install OPOC for offline access on site.</span>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={async () => {
              await deferredPrompt.prompt();
              await deferredPrompt.userChoice;
              setDeferredPrompt(null);
            }}
          >
            Install
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDismissed(true)}>
            Dismiss
          </Button>
        </div>
      </div>
    );
  }

  if (ios) {
    return (
      <div className="flex items-center justify-between gap-3 border-b bg-muted/40 px-4 py-2 text-sm">
        <span>
          Install OPOC: tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>.
        </span>
        <Button size="sm" variant="ghost" onClick={() => setDismissed(true)}>
          Dismiss
        </Button>
      </div>
    );
  }

  return null;
}
