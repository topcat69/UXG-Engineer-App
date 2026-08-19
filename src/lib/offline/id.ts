/**
 * crypto.randomUUID() is spec-gated to secure contexts (HTTPS or
 * localhost) — it's simply undefined on plain HTTP, which is how this app
 * is currently deployed on the VM (same root cause as the Geolocation API
 * gap, see DECISIONS.md's "compulsory GPS" addendum). crypto.getRandomValues()
 * has no such restriction, so build a UUID v4 from it when the convenience
 * method isn't available, rather than every offline write throwing
 * "crypto.randomUUID is not a function".
 */
export function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6]! & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8]! & 0x3f) | 0x80; // variant 10
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  // Last-resort fallback for an environment with no Web Crypto at all —
  // not cryptographically strong, but these ids are local dedup/primary
  // keys, never security tokens, so that's an acceptable trade for still
  // working at all.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
