"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, RefreshCw, Wifi, WifiOff, X } from "lucide-react";
import { deleteOfflineItem, getOfflineCount, getOfflineItems, patchOfflineItem, subscribeOfflineQueue, type OfflineQueueItem } from "@/lib/offline-db";
import { syncAllOfflineJobs } from "@/lib/offline-job";

type NetInfo = { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean };

export default function OnlineStatus() {
  const [online, setOnline] = useState(true);
  const [ping, setPing] = useState<number | null>(null);
  const [info, setInfo] = useState<NetInfo>({});
  const [pending, setPending] = useState(0);
  const [items, setItems] = useState<OfflineQueueItem[]>([]);
  const [open, setOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string>("");

  async function refreshPending(){ try { const [count,rows]=await Promise.all([getOfflineCount(),getOfflineItems()]); setPending(count);setItems(rows); } catch { setPending(0);setItems([]); } }
  async function measure(){
    const isOnline = navigator.onLine;
    setOnline(isOnline);
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if(connection) setInfo({effectiveType:connection.effectiveType,downlink:connection.downlink,rtt:connection.rtt,saveData:connection.saveData});
    if(!isOnline){setPing(null);return;}
    const t=performance.now();
    try{
      const res=await fetch(`/manifest.webmanifest?net=${Date.now()}`,{cache:"no-store"});
      if(!res.ok) throw new Error();
      setPing(Math.round(performance.now()-t));
    }catch{setPing(null);}
  }

  useEffect(() => {
    const update=()=>{measure();refreshPending()};
    update();
    window.addEventListener("online",update);window.addEventListener("offline",update);
    const connection=(navigator as any).connection;
    connection?.addEventListener?.("change",update);
    const unsubscribe=subscribeOfflineQueue(refreshPending);
    const syncDone=(e:any)=>{setLastSync(new Date().toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"}));refreshPending();};
    window.addEventListener("been:offline-sync-complete",syncDone);
    const timer=window.setInterval(measure,30000);
    return()=>{window.removeEventListener("online",update);window.removeEventListener("offline",update);connection?.removeEventListener?.("change",update);window.removeEventListener("been:offline-sync-complete",syncDone);unsubscribe();window.clearInterval(timer)};
  },[]);

  const quality=useMemo(()=>{
    if(!online)return {label:"Offline",cls:"bg-red-600 text-white"};
    const p=ping ?? info.rtt ?? 0;
    if(p>400)return {label:"Mạng rất yếu",cls:"bg-red-500 text-white"};
    if(p>180)return {label:"Mạng yếu",cls:"bg-amber-500 text-slate-950"};
    if(p>80)return {label:"Trung bình",cls:"bg-yellow-300 text-slate-950"};
    return {label:"Online",cls:"bg-emerald-600 text-white"};
  },[online,ping,info.rtt]);

  async function syncNow(){if(!online||syncing)return;setSyncing(true);try{await syncAllOfflineJobs();setLastSync(new Date().toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"}));await refreshPending()}finally{setSyncing(false)}}

  async function keepServer(item:OfflineQueueItem){
    if(!confirm("Bỏ bản offline này và giữ dữ liệu đang có trên hệ thống?"))return;
    await deleteOfflineItem(item.id);await refreshPending();
  }
  async function forceLocal(item:OfflineQueueItem){
    if(!confirm("Ghi bản offline của bạn đè lên dữ liệu hiện tại trên hệ thống? Chỉ dùng khi bạn chắc chắn."))return;
    await patchOfflineItem(item.id,{status:"pending",lastError:"",payload:{...item.payload,baseUpdatedAt:null}});
    await syncNow();
  }
  async function retryItem(item:OfflineQueueItem){
    await patchOfflineItem(item.id,{status:"pending",lastError:""});
    await syncNow();
  }
  const speed=typeof info.downlink==="number"?`${info.downlink.toFixed(1)} Mbps`:"Không đo được";
  const latency=ping!=null?`${ping} ms`:info.rtt?`~${info.rtt} ms`:"—";

  return <>
    <button onClick={()=>setOpen(v=>!v)} className={`fixed bottom-[76px] right-3 z-[110] flex max-w-[calc(100vw-24px)] items-center gap-2 rounded-full px-3 py-2 text-xs font-bold shadow-xl lg:bottom-4 ${quality.cls}`} title="Trạng thái mạng và đồng bộ">
      {online?<Wifi size={16}/>:<WifiOff size={16}/>}<span>{quality.label}</span>{online&&<span className="opacity-90">• {latency}</span>}{pending>0&&<span className="rounded-full bg-black/20 px-2 py-0.5">{pending} chờ sync</span>}
    </button>
    {open&&<div className="fixed bottom-[120px] right-3 z-[120] w-[min(360px,calc(100vw-24px))] rounded-2xl border bg-white p-4 text-slate-900 shadow-2xl lg:bottom-16">
      <div className="flex items-start justify-between gap-3"><div><b className="flex items-center gap-2"><Activity size={18}/>Mạng & đồng bộ</b><p className="mt-1 text-xs text-slate-500">Theo dõi dữ liệu đang nằm trên máy và trạng thái kết nối.</p></div><button onClick={()=>setOpen(false)} className="rounded-lg p-1 hover:bg-slate-100"><X size={18}/></button></div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-sm"><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Kết nối</p><b>{online?quality.label:"Offline"}</b></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Độ trễ</p><b>{latency}</b></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Ước tính tốc độ</p><b>{speed}</b></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Loại mạng</p><b>{String(info.effectiveType||"Không xác định").toUpperCase()}</b></div></div>
      <div className={`mt-3 rounded-xl p-3 text-sm ${pending?"bg-amber-50 text-amber-900":"bg-emerald-50 text-emerald-900"}`}><b>{pending?`${pending} thay đổi chưa đồng bộ`:`Tất cả dữ liệu đã đồng bộ`}</b>{lastSync&&<p className="mt-1 text-xs">Đồng bộ gần nhất: {lastSync}</p>}</div>
      {items.length>0&&<div className="mt-3 max-h-56 space-y-2 overflow-y-auto">{items.slice(0,8).map(item=><div key={item.id} className={`rounded-xl border p-3 text-xs ${item.status==="conflict"?"border-red-200 bg-red-50":item.status==="error"?"border-amber-200 bg-amber-50":"bg-slate-50"}`}><div className="flex items-center justify-between gap-2"><b>{item.type==="job_bundle"?"Job":"Khách hàng"} • {item.status==="conflict"?"Xung đột":item.status==="error"?"Lỗi":"Chờ đồng bộ"}</b><span className="text-slate-400">{new Date(item.createdAt).toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"})}</span></div>{item.lastError&&<p className="mt-1 text-red-600">{item.lastError}</p>}{item.status==="conflict"?<div className="mt-2 flex gap-2"><button onClick={()=>keepServer(item)} className="flex-1 rounded-lg border bg-white px-2 py-2 font-semibold">Giữ bản server</button><button onClick={()=>forceLocal(item)} className="flex-1 rounded-lg bg-red-600 px-2 py-2 font-semibold text-white">Giữ bản của tôi</button></div>:item.status==="error"&&<button onClick={()=>retryItem(item)} className="mt-2 rounded-lg bg-amber-600 px-3 py-2 font-semibold text-white">Thử lại</button>}</div>)}</div>}
      <button onClick={syncNow} disabled={!online||syncing||pending===0} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 p-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"><RefreshCw size={16} className={syncing?"animate-spin":""}/>{syncing?"Đang đồng bộ...":"Đồng bộ ngay"}</button>
    </div>}
  </>;
}
