"use client";

import { useEffect, useState } from "react";
import { Wifi, WifiOff } from "lucide-react";

export default function OnlineStatus() {
  const [online, setOnline] = useState(true);
  const [showBackOnline, setShowBackOnline] = useState(false);

  useEffect(() => {
    const update = () => {
      const next = navigator.onLine;
      setOnline((prev) => {
        if (!prev && next) {
          setShowBackOnline(true);
          window.setTimeout(() => setShowBackOnline(false), 2500);
        }
        return next;
      });
    };
    setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!online) {
    return (
      <div className="fixed bottom-20 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-sm font-bold text-slate-950 shadow-xl lg:bottom-5">
        <WifiOff size={17} /> Mất mạng • dữ liệu đang nhập được giữ nháp
      </div>
    );
  }
  if (showBackOnline) {
    return (
      <div className="fixed bottom-20 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-xl lg:bottom-5">
        <Wifi size={17} /> Đã có mạng trở lại
      </div>
    );
  }
  return null;
}
