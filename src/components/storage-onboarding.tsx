"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/offline/db";
import { requestPersistentStorage } from "@/lib/offline/persistent-storage";

const ONBOARDING_KEY = "storage_onboarding_asked";

export function StorageOnboarding() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    db.syncMeta.get(ONBOARDING_KEY).then((row) => {
      if (!row) setVisible(true);
    });
  }, []);

  async function markAsked() {
    await db.syncMeta.put({ key: ONBOARDING_KEY, value: "true" });
    setVisible(false);
  }

  async function handleEnable() {
    await requestPersistentStorage();
    await markAsked();
  }

  if (!visible) return null;

  return (
    // Deliberately NOT `fixed` — a fixed bottom banner overlapped and ate
    // clicks on the submit button in the job workflow beneath it. Normal
    // flow means it can never cover interactive content, at the cost of
    // needing a scroll to see it on a full page.
    <div className="bg-background border-t p-4 shadow-lg">
      <p className="text-sm font-medium">Keep your job data safe</p>
      <p className="text-muted-foreground mt-1 text-sm">
        Allow notifications so this phone doesn&apos;t delete unsent job data when storage runs
        low. You can still complete jobs offline either way.
      </p>
      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={handleEnable}>
          Enable
        </Button>
        <Button size="sm" variant="outline" onClick={markAsked}>
          Not now
        </Button>
      </div>
    </div>
  );
}
