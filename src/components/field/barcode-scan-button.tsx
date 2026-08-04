"use client";

import { BrowserMultiFormatReader } from "@zxing/library";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

// BarcodeDetector is a real, shipping browser API (Chrome/Android/Edge) but
// TypeScript's lib.dom doesn't declare it yet — hence the ambient type.
declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats?: string[] }) => {
      detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>;
    };
  }
}

export function BarcodeScanButton({ onScan }: { onScan: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const zxingReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        if (window.BarcodeDetector) {
          const detector = new window.BarcodeDetector();
          const scanFrame = async () => {
            if (cancelled || !videoRef.current) return;
            try {
              const results = await detector.detect(videoRef.current);
              if (results.length > 0) {
                onScan(results[0].rawValue);
                setOpen(false);
                return;
              }
            } catch {
              // keep polling; a single failed detect() isn't fatal
            }
            rafRef.current = requestAnimationFrame(scanFrame);
          };
          rafRef.current = requestAnimationFrame(scanFrame);
        } else if (videoRef.current) {
          const reader = new BrowserMultiFormatReader();
          zxingReaderRef.current = reader;
          reader.decodeFromVideoElementContinuously(videoRef.current, (result) => {
            if (result && !cancelled) {
              onScan(result.getText());
              setOpen(false);
            }
          });
        }
      } catch {
        setError("Camera unavailable — enter the serial manually below.");
      }
    }

    start();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      zxingReaderRef.current?.reset();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open, onScan]);

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        Scan
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4">
          <video ref={videoRef} className="max-h-[70vh] w-full max-w-md rounded-md" muted playsInline />
          {error && <p className="mt-2 text-sm text-white">{error}</p>}
          <Button size="sm" variant="secondary" className="mt-4" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      )}
    </>
  );
}
