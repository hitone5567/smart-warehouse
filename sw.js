/* Service worker v3 — never precache catalog; network-first for data-*.js */
const CACHE_NAME = "warehouse-shell-v3";
const SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png", "./icons/icon-512.png",
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
    return new URL(url).pathname.includes("/images/");
  } catch (_) {
    return false;
  }
}

function isCatalogData(url) {
  try {
    const p = new URL(url).pathname;
    return /\/data(?:-v\d+)?\.js$/i.test(p) || p.endsWith("/data.js");
  } catch (_) {
    return false;
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  if (isHugeDataUrl(req)) return;
  const url = req.url;

  if (isCatalogData(url)) {
    event.respondWith(
      fetch(req, { cache: "no-store" })
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

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (!res || !res.ok) return res;
          const ct = res.headers.get("content-type") || "";
          if (ct.startsWith("text/") || ct.includes("javascript") || ct.includes("json") || ct.includes("manifest") || ct.startsWith("image/")) {
            const clone = res.clone();
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
