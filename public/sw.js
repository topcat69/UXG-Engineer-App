// Hand-rolled service worker (see DECISIONS.md for why: Turbopack, this
// project's bundler, doesn't support webpack plugins, and @serwist/next's
// build-time precache-manifest injection is one).
//
// Scope is deliberately narrow: this only makes the *app shell* (HTML/JS/CSS)
// available offline, so the page can load and render at all with no network.
// The actual data layer — jobs, forms, photos, the outbox — is Dexie
// (IndexedDB), handled entirely in application code. This worker never
// touches Supabase requests; those fail offline exactly as they should, and
// the app already knows to fall back to Dexie when they do.

const CACHE_VERSION = "opoc-shell-v1";
// Only truly public, auth-independent assets go in the install-time precache.
// Auth-gated pages like /my-jobs are populated by networkFirst() the first
// time they're actually visited while online — precaching them here would
// often cache the (wrong) redirect-to-/login response for a not-yet-signed-in
// visitor instead.
const APP_SHELL = ["/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // never intercept Supabase/Mailpit/etc.

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const response = await fetch(request);
    cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    return cached ?? cache.match("/my-jobs");
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((response) => {
      cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);
  return cached ?? (await networkPromise);
}
