"use client";

import { useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { InstallPrompt } from "@/components/install-prompt";
import { UxgLogo } from "@/components/branding/uxg-logo";
import { StorageOnboarding } from "@/components/storage-onboarding";
import type { CurrentUser } from "@/lib/auth/current-user";
import { db } from "@/lib/offline/db";
import { summarizeOutbox } from "@/lib/offline/outbox";
import { useSyncEngine } from "@/lib/offline/use-sync-engine";
import { JobList } from "./job-list";
import { JobWorkflow } from "./job-workflow";
import { OutboxScreen } from "./outbox-screen";

type View = { screen: "list" } | { screen: "job"; jobId: string } | { screen: "outbox" };

export function FieldApp({ user }: { user: CurrentUser }) {
  const [view, setView] = useState<View>({ screen: "list" });
  const { isSyncing, runSync } = useSyncEngine(user.id);

  const ops = useLiveQuery(() => db.outbox.toArray(), [], []);
  const media = useLiveQuery(() => db.mediaQueue.toArray(), [], []);
  const summary = summarizeOutbox(ops ?? [], media ?? []);
  const hasPending = summary.pendingOps > 0 || summary.pendingMedia > 0;

  return (
    <div className="flex min-h-screen flex-col">
      <InstallPrompt />
      <header className="flex items-center justify-between border-b px-4 py-3">
        <button onClick={() => setView({ screen: "list" })} type="button">
          <UxgLogo className="h-6 w-auto" />
        </button>
        <div className="flex items-center gap-3 text-sm">
          {isSyncing && <span className="text-muted-foreground">Syncing…</span>}
          <button
            type="button"
            onClick={() => setView({ screen: "outbox" })}
            className={
              hasPending
                ? "rounded-full bg-amber-100 px-2 py-1 text-amber-900"
                : "text-muted-foreground"
            }
          >
            {hasPending ? `${summary.pendingOps + summary.pendingMedia} unsent` : "All synced"}
          </button>
          <span className="text-muted-foreground">{user.name}</span>
          {/* Managers/superadmins can be assigned jobs too, so they can reach this
              app — but unlike an engineer, they also have somewhere to switch back to. */}
          {(user.role === "manager" || user.role === "superadmin") && (
            <Link href="/office/jobs" className="text-muted-foreground underline">
              Office
            </Link>
          )}
        </div>
      </header>

      <main className="flex-1">
        {view.screen === "list" && (
          <JobList currentUserId={user.id} onOpenJob={(jobId) => setView({ screen: "job", jobId })} />
        )}
        {view.screen === "job" && (
          <JobWorkflow
            jobId={view.jobId}
            currentUser={user}
            onBack={() => setView({ screen: "list" })}
            onMutated={runSync}
          />
        )}
        {view.screen === "outbox" && (
          <OutboxScreen onBack={() => setView({ screen: "list" })} onRetry={runSync} />
        )}
      </main>

      <StorageOnboarding />
    </div>
  );
}
