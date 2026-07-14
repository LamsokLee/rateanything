/**
 * Service Worker — Network-first strategy.
 * Falls back to cache only when offline; returns 503 if both fail.
 */
const CACHE_NAME = "rateanything-v1";

self.addEventListener("install", (e) => {
  // Activate immediately without waiting for existing clients to close
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  // Claim all clients so the SW is active on first load
  e.waitUntil(clients.claim());
});

self.addEventListener("fetch", (e) => {
  // Network-first: try network, fall back to cache, then 503 fallback
  // respondWith() requires a Response — never pass undefined
  e.respondWith(
    fetch(e.request).catch(() =>
      caches.match(e.request).then(
        (cached) => cached || new Response("Offline", { status: 503, statusText: "Service Unavailable" })
      )
    )
  );
});
