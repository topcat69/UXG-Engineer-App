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
    try {
      const blob: Blob = await new Promise((resolve, reject) => {
        canvasRef.current!.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png");
      });
      await enqueueSignature({
        jobId,
        blob,
        signerName: clientName || "Client",
        signerRole: "Client",
        capturedBy,
      });
      pad.clear();
      onCaptured?.();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
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
    </div>
  );
}
