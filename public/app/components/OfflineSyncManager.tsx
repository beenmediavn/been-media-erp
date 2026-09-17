"use client";

import { useEffect } from "react";
import { syncAllOfflineJobs } from "@/lib/offline-job";

export default function OfflineSyncManager() {
  useEffect(() => {
    let stopped = false;
    let running = false;
    const run = async () => {
      if (stopped || running || !navigator.onLine) return;
      running = true;
      try { await syncAllOfflineJobs(); } catch {} finally { running = false; }
    };
    const online = () => { window.setTimeout(run, 500); };
    window.addEventListener("online", online);
    run();
    const timer = window.setInterval(run, 30000);
    return () => { stopped = true; window.removeEventListener("online", online); window.clearInterval(timer); };
  }, []);
  return null;
}
