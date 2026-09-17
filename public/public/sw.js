const CACHE = "been-erp-v8-3-6-offline";
const STATIC = ["/manifest.webmanifest", "/offline.html", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(STATIC).catch(() => {})));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(Promise.all([
    self.clients.claim(),
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
  ]));
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  // Navigation luôn ưu tiên mạng; chỉ dùng cache khi thật sự offline.
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req, { cache: "no-store" });
        if (fresh.ok) caches.open(CACHE).then((cache) => cache.put(req, fresh.clone())).catch(() => {});
        return fresh;
      } catch {
        return (await caches.match(req)) || (await caches.match("/offline.html"));
      }
    })());
    return;
  }

  // Next static: NETWORK FIRST để deploy phiên bản mới không bị dính bundle cũ.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req, { cache: "no-store" });
        if (fresh.ok) caches.open(CACHE).then((cache) => cache.put(req, fresh.clone())).catch(() => {});
        return fresh;
      } catch {
        const cached = await caches.match(req);
        if (cached) return cached;
        throw new Error("offline-static-miss");
      }
    })());
    return;
  }

  if (url.pathname.startsWith("/icons/") || url.pathname === "/manifest.webmanifest" || url.pathname === "/offline.html") {
    event.respondWith(caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      if (res.ok) caches.open(CACHE).then((cache) => cache.put(req, res.clone())).catch(() => {});
      return res;
    })));
  }
});
