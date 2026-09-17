"use client";
import { useEffect, useState } from "react";
import { Wifi, WifiOff } from "lucide-react";

export default function OnlineStatus(){
  const [online,setOnline]=useState(true);
  const [unstable,setUnstable]=useState(false);
  useEffect(()=>{
    const refresh=()=>{ setOnline(navigator.onLine); if(!navigator.onLine)setUnstable(false); };
    refresh();
    window.addEventListener("online",refresh); window.addEventListener("offline",refresh);
    // Chỉ đánh dấu vàng khi trình duyệt báo kết nối chập chờn nhiều lần; không dùng RTT/downlink để suy ra Mbps.
    let failures=0;
    const onUnhandled=()=>{ if(navigator.onLine){ failures++; if(failures>=3)setUnstable(true); } };
    const reset=()=>{ failures=0; if(navigator.onLine)setUnstable(false); };
    window.addEventListener("unhandledrejection",onUnhandled);
    const timer=window.setInterval(reset,30000);
    return()=>{window.removeEventListener("online",refresh);window.removeEventListener("offline",refresh);window.removeEventListener("unhandledrejection",onUnhandled);window.clearInterval(timer)};
  },[]);
  const state=!online?{label:"Mất mạng",cls:"bg-red-500 text-white",Icon:WifiOff}:unstable?{label:"Mạng yếu",cls:"bg-amber-500 text-slate-950",Icon:Wifi}:{label:"Mạng khỏe",cls:"bg-emerald-600 text-white",Icon:Wifi};
  const Icon=state.Icon;
  return <div className={`fixed bottom-3 right-3 z-[90] flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold shadow-lg ${state.cls}`} title="Trạng thái kết nối"><Icon size={15}/>{state.label}</div>;
}
