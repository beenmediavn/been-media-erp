const CACHE = "been-erp-v7-14-pwa";
const STATIC = ["/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(STATIC).catch(() => {}))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
      ),
    ])
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  // HTML navigation: always use the current deployment first.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req, { cache: "no-store" }).catch(async () => {
        const fallback = await caches.match("/");
        if (fallback) return fallback;
        return new Response(
          '<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:system-ui;padding:24px"><h3>BEEN MEDIA ERP</h3><p>Không có kết nối mạng. Hãy kết nối Internet rồi mở lại ứng dụng.</p></body></html>',
          { headers: { "Content-Type": "text/html; charset=utf-8" } }
        );
      })
    );
    return;
  }

  // Next.js hashed JS/CSS: network first to prevent an installed icon from booting an obsolete build.
  if (url.pathname.startsWith("/_next/")) {
    event.respondWith(fetch(req, { cache: "no-store" }));
    return;
  }

  // Only cache stable PWA assets.
  if (url.pathname.startsWith("/icons/") || url.pathname === "/manifest.webmanifest") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
  }
});
