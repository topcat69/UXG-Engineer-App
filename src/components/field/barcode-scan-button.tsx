"use client";

import { BrowserMultiFormatReader } from "@zxing/library";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { isIOS, isStandalone } from "@/lib/device";

// BarcodeDetector is a real, shipping browser API (Chrome/Android/Edge) but
// TypeScript's lib.dom doesn't declare it yet — hence the ambient type.
declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats?: string[] }) => {
      detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>;
    };
  }
}

/**
 * getUserMedia throws a DOMException whose `.name` says why — surfacing
 * that (instead of one generic "Camera unavailable" for every cause, as
 * this used to) is the difference between a permission problem, a busy
 * camera, and a device that genuinely has none, all of which need a
 * different fix from whoever's looking at this. NotAllowedError gets its
 * own message on iOS standalone specifically: a home-screen "Add to Home
 * Screen" web app runs in a separate WebKit context from a regular Safari
 * tab, and iOS has a long history of that context either never showing the
 * camera permission prompt at all or not honouring a grant made in Safari
 * — "I already allowed it" (in Safari) and "the installed app still can't
 * get a camera" are both true at once. Opening the same URL in Safari
 * itself is the fastest way to tell whether that's what's happening.
 */
function cameraErrorMessage(err: unknown): string {
  const name = err instanceof DOMException ? err.name : null;

  if (name === "NotAllowedError" && isStandalone() && isIOS()) {
    return "Camera permission isn't reaching this installed app on iOS, even if you've allowed it in Safari — try opening this app in Safari itself (not the home screen icon) to scan, or enter the serial manually below.";
  }
  if (name === "NotAllowedError") {
    return "Camera access was denied — check this site's camera permission in your browser settings, or enter the serial manually below.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "No usable camera found on this device — enter the serial manually below.";
  }
  if (name === "NotReadableError" || name === "AbortError") {
    return "The camera didn't start — it may be in use by another app (or another browser tab). Close it, fully quit and reopen Safari, and try again — or enter the serial manually below.";
  }
  return `Camera unavailable${name ? ` (${name})` : ""} — enter the serial manually below.`;
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
      // getUserMedia (like crypto.randomUUID/geolocation elsewhere in this
      // app) is a secure-context-only API — `navigator.mediaDevices` itself
      // is undefined on a plain-HTTP origin in most browsers, not just
      // permission-denied. Checking for it upfront gives a message that
      // actually explains why, instead of a generic "camera unavailable"
      // that reads like a hardware fault.
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Camera scanning needs a secure (HTTPS) connection — enter the serial manually below.");
        return;
      }
      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        } catch (constrainedError) {
          // Some browsers (certain iOS Safari versions especially) throw on
          // the facingMode constraint itself rather than just falling back
          // to whatever camera is available — retry with no constraint at
          // all before giving up. OverconstrainedError is the spec name for
          // this; Safari has a well-documented habit of reporting the exact
          // same "can't negotiate facingMode:environment" failure as
          // AbortError instead, so both are worth a retry. A genuine
          // permission or hardware failure would just fail the same way
          // again, so this costs nothing when it isn't the real cause.
          const name = constrainedError instanceof DOMException ? constrainedError.name : null;
          if (name === "OverconstrainedError" || name === "AbortError") {
            stream = await navigator.mediaDevices.getUserMedia({ video: true });
          } else {
            throw constrainedError;
          }
        }
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          try {
            await videoRef.current.play();
          } catch (playError) {
            // Safari has a well-known quirk where the play() promise
            // rejects with AbortError even though the video — muted and
            // playsInline, so autoplay is allowed — actually starts
            // anyway moments later regardless of that promise's outcome.
            // Treating this as fatal produced the confusing "camera
            // didn't start" message while a live feed was visibly playing
            // right above it. Only a real (non-AbortError) play() failure
            // should stop the scan here.
            if (!(playError instanceof DOMException && playError.name === "AbortError")) {
              throw playError;
            }
          }
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
      } catch (err) {
        setError(cameraErrorMessage(err));
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
