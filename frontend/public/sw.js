// Service worker: lets the app be installed and lets its screens open without a connection.
// It keeps the app's own files only. Nothing under /api/ (sign-in, portfolio figures) is ever
// stored here, so a customer's data never sits in this cache.
//
// Bump VERSION to make every phone drop its stored copy on the next visit.
const VERSION = "v1";
const SHELL = `pgo-shell-${VERSION}`;
const ASSETS = `pgo-assets-${VERSION}`;
const SHELL_FILES = ["/", "/manifest.webmanifest", "/pgo-logo.png", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("pgo-") && k !== SHELL && k !== ASSETS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function put(cacheName, request, response) {
  if (response && response.ok) (await caches.open(cacheName)).put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // always straight to the server, never stored

  // Opening the app: the newest page when online, the stored one when not.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then((response) => put(SHELL, "/", response)).catch(() => caches.match("/")));
    return;
  }

  // Built files carry a fingerprint in their name, so a stored copy is always the right one.
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(caches.match(request).then((hit) => hit || fetch(request).then((response) => put(ASSETS, request, response))));
    return;
  }

  // Icons and the like: the stored copy at once, refreshed in the background.
  event.respondWith(
    caches.match(request).then((hit) => {
      const fresh = fetch(request).then((response) => put(SHELL, request, response)).catch(() => hit);
      return hit || fresh;
    })
  );
});
