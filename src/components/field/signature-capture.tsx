"use client";

import SignaturePadLib from "signature_pad";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { enqueueSignature } from "@/lib/offline/media-capture";

export function SignatureCapture({
  jobId,
  capturedBy,
  captured,
  clientName,
  onCaptured,
}: {
  jobId: string;
  capturedBy: string;
  captured: boolean;
  clientName: string;
  onCaptured?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePadLib | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Who actually signs on site is often not the site's registered contact
  // (a different manager, a receptionist, whoever's around) — clientName is
  // just a starting point to save typing, not assumed correct. Title is
  // free text (Site Manager, Duty Manager, ...), not the hardcoded "Client"
  // this used to send regardless of who signed.
  const [signerName, setSignerName] = useState(clientName);
  const [signerTitle, setSignerTitle] = useState("");
  const nameEditedRef = useRef(false);

  // clientName can still be filling in after this component mounts — the
  // legacy survey path's "Client name" field lives earlier in the same
  // form and is typed into after the signature block has already rendered.
  // Keep tracking it until the engineer actually edits Name themselves.
  useEffect(() => {
    if (!nameEditedRef.current) setSignerName(clientName);
  }, [clientName]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext("2d")?.scale(ratio, ratio);

    padRef.current = new SignaturePadLib(canvas);
    return () => padRef.current?.off();
  }, []);

  async function handleSave() {
    const pad = padRef.current;
    if (!pad || pad.isEmpty()) return;
    setIsSaving(true);
    setError(null);
    try {
      const blob: Blob = await new Promise((resolve, reject) => {
        canvasRef.current!.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png");
      });
      await enqueueSignature({
        jobId,
        blob,
        signerName: signerName.trim() || "Customer",
        signerRole: signerTitle.trim() || "Customer",
        capturedBy,
      });
      pad.clear();
      onCaptured?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong saving the signature — please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <div className="flex flex-1 flex-col gap-1">
          <label className="text-muted-foreground text-xs">Name</label>
          <input
            value={signerName}
            onChange={(e) => {
              nameEditedRef.current = true;
              setSignerName(e.target.value);
            }}
            placeholder="Who's signing"
            className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
          />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <label className="text-muted-foreground text-xs">Title</label>
          <input
            value={signerTitle}
            onChange={(e) => setSignerTitle(e.target.value)}
            placeholder="e.g. Site Manager"
            className="border-input h-9 rounded-md border bg-transparent px-2 text-sm"
          />
        </div>
      </div>
      <canvas
        ref={canvasRef}
        className="h-40 w-full rounded-md border bg-white"
        style={{ touchAction: "none" }}
      />
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => padRef.current?.clear()}>
          Clear
        </Button>
        <Button type="button" size="sm" onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Saving…" : "Save signature"}
        </Button>
        {captured && <span className="text-sm text-green-700">✅ Signature captured</span>}
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
