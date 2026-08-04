"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { createShareLink, revokeShareLink } from "./actions";

export type ShareLinkRow = { token: string; expires_at: string; url: string };

export function ShareLinkPanel({ jobId, links }: { jobId: string; links: ShareLinkRow[] }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [newUrl, setNewUrl] = useState<string | null>(null);

  function handleCreate() {
    startTransition(async () => {
      const result = await createShareLink(jobId, 30);
      if (result.ok) {
        setNewUrl(result.url);
        setMessage(null);
      } else {
        setMessage(result.message);
      }
    });
  }

  function handleRevoke(token: string) {
    startTransition(async () => {
      const result = await revokeShareLink(token, jobId);
      setMessage(result.message);
    });
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-medium">Share link</h2>
      <p className="text-muted-foreground text-sm">
        Opens with no account and shows only this job&apos;s status and (once approved) its photos.
      </p>
      {links.map((link) => (
        <div key={link.token} className="flex items-center gap-2 text-sm">
          <code className="bg-muted rounded px-2 py-1 text-xs">{link.url}</code>
          <span className="text-muted-foreground text-xs">expires {new Date(link.expires_at).toLocaleDateString()}</span>
          <Button type="button" variant="ghost" size="sm" disabled={isPending} onClick={() => handleRevoke(link.token)}>
            Revoke
          </Button>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={handleCreate}>
          Create share link
        </Button>
        {message && <span className="text-muted-foreground text-sm">{message}</span>}
      </div>
      {newUrl && <code className="bg-muted w-fit rounded px-2 py-1 text-xs">{newUrl}</code>}
    </section>
  );
}
