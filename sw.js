/* Service worker — cache-first app shell; network-first for images/ */
const CACHE_NAME = "warehouse-shell-v1";
const SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./data.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

function isHugeDataUrl(request) {
  const url = request.url || "";
  return url.startsWith("data:") && url.length > 50000;
}

function isImagePath(url) {
  try {
    const u = new URL(url);
    return u.pathname.includes("/images/");
  } catch (_) {
    return false;
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  if (isHugeDataUrl(req)) return;

  const url = req.url;

  // Network-first (fallback cache) for product images
  if (isImagePath(url)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, clone));
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Cache-first for app shell / same-origin static
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (!res || !res.ok) return res;
          const ct = res.headers.get("content-type") || "";
          // Skip caching opaque/huge or data-like payloads
          if (ct.startsWith("text/") || ct.includes("javascript") || ct.includes("json") || ct.includes("manifest") || ct.startsWith("image/")) {
            const clone = res.clone();
            // Don't cache enormous responses (e.g. accidental data URL GETs)
            const len = res.headers.get("content-length");
            if (!len || Number(len) < 2_000_000) {
              caches.open(CACHE_NAME).then((c) => c.put(req, clone));
            }
          }
          return res;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});
