/**
 * Standalone (home-screen "Add to Home Screen") detection, shared between
 * InstallPrompt (don't offer installing what's already installed) and
 * BarcodeScanButton (iOS's standalone web-app context has known getUserMedia
 * camera limitations distinct from a regular Safari tab — see that
 * component's comment).
 */
export function isStandalone(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // Safari's own non-standard flag — matchMedia above doesn't cover iOS.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
