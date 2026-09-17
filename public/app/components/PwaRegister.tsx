"use client";

import { useEffect } from "react";

export default function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1";

    // Khi dev/local: tuyệt đối không cho Service Worker cũ giữ bundle Next.js cũ.
    if (isLocal) {
      navigator.serviceWorker.getRegistrations().then((regs) =>
        Promise.all(regs.map((r) => r.unregister()))
      ).catch(() => {});
      if ("caches" in window) {
        caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).catch(() => {});
      }
      return;
    }

    let cancelled = false;
    navigator.serviceWorker
      .register("/sw.js?v=835", { scope: "/", updateViaCache: "none" })
      .then((registration) => {
        if (!cancelled) registration.update().catch(() => {});
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, []);

  return null;
}
