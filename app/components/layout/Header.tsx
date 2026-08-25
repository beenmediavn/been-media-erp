"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, LogOut, Menu, Search, UserCircle2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { clearSession, type AppUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useBranding } from "../useBranding";

const localDate=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const addDays=(n:number)=>{const d=new Date();d.setDate(d.getDate()+n);return localDate(d)};
const money=(v:any)=>Number(v||0).toLocaleString("vi-VN")+" đ";

type SearchResult={key:string;title:string;sub:string;href:string;kind:string};

export default function Header({user,onMenuClick}:{user:AppUser;onMenuClick?:()=>void}){
 const router=useRouter(); const brand=useBranding();
 const [q,setQ]=useState(""); const [results,setResults]=useState<SearchResult[]>([]); const [searching,setSearching]=useState(false); const [showSearch,setShowSearch]=useState(false);
 const [notifications,setNotifications]=useState<any[]>([]); const [showNotifications,setShowNotifications]=useState(false);
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 function logout(){clearSession();router.replace("/login")}

 useEffect(()=>{(async()=>{try{const today=localDate(),tomorrow=addDays(1);const [{data:days},{data:debts}]=await Promise.all([
   supabase.from("job_days").select("id,shooting_date,start_time,jobs(id,event_name,customer_name)").gte("shooting_date",today).lte("shooting_date",tomorrow).order("shooting_date").limit(8),
   supabase.from("jobs").select("id,event_name,customer_name,debt,status").gt("debt",0).order("debt",{ascending:false}).limit(5)
  ]);const list:any[]=[];(days||[]).forEach((d:any)=>list.push({id:"d"+d.id,type:"job",title:d.jobs?.event_name||d.jobs?.customer_name||"Job sắp tới",sub:`${d.shooting_date===today?"Hôm nay":"Ngày mai"} • ${d.start_time||"--:--"}`,href:"/schedule"}));(debts||[]).forEach((j:any)=>list.push({id:"n"+j.id,type:"debt",title:j.event_name||j.customer_name||"Khách còn nợ",sub:`Còn nợ ${money(j.debt)}`,href:"/payments"}));setNotifications(list)}catch{}})()},[]);

 useEffect(()=>{if(timer.current)clearTimeout(timer.current);const term=q.trim();if(term.length<2){setResults([]);setSearching(false);return;}setSearching(true);timer.current=setTimeout(async()=>{try{const safe=term.replace(/[,()]/g," ");const [{data:customers},{data:jobs},{data:employees}]=await Promise.all([
   supabase.from("customers").select("id,full_name,phone,service").or(`full_name.ilike.%${safe}%,phone.ilike.%${safe}%`).limit(5),
   supabase.from("jobs").select("id,event_name,customer_name,customer_phone,status").or(`event_name.ilike.%${safe}%,customer_name.ilike.%${safe}%,customer_phone.ilike.%${safe}%`).limit(5),
   supabase.from("employees").select("id,full_name,phone,role").or(`full_name.ilike.%${safe}%,phone.ilike.%${safe}%`).limit(4)
  ]);const out:SearchResult[]=[];(customers||[]).forEach((x:any)=>out.push({key:"c"+x.id,title:x.full_name||"Khách hàng",sub:[x.phone,x.service].filter(Boolean).join(" • "),href:"/customers",kind:"Khách"}));(jobs||[]).forEach((x:any)=>out.push({key:"j"+x.id,title:x.event_name||x.customer_name||"Job",sub:[x.customer_name,x.status].filter(Boolean).join(" • "),href:`/job?open=${x.id}`,kind:"Job"}));(employees||[]).forEach((x:any)=>out.push({key:"e"+x.id,title:x.full_name||"Nhân sự",sub:[x.role,x.phone].filter(Boolean).join(" • "),href:"/employees",kind:"Nhân sự"}));setResults(out)}catch{setResults([])}finally{setSearching(false)}},280);return()=>{if(timer.current)clearTimeout(timer.current)}},[q]);

 const notificationCount=useMemo(()=>notifications.length,[notifications]);
 return <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-white px-4 text-slate-900 sm:px-6 lg:px-8">
   <div className="relative flex min-w-0 flex-1 items-center gap-3 text-gray-500"><button onClick={onMenuClick} aria-label="Mở menu" className="rounded-lg border p-2 text-slate-700 lg:hidden"><Menu size={20}/></button><div className="relative hidden w-full max-w-xl sm:block"><Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={q} onFocus={()=>setShowSearch(true)} onChange={e=>{setQ(e.target.value);setShowSearch(true)}} placeholder="Tìm khách, SĐT, Job, nhân sự..." className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-9 text-sm text-slate-900 focus:bg-white"/>{q&&<button onClick={()=>{setQ("");setResults([])}} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400"><X size={16}/></button>}{showSearch&&q.trim().length>=2&&<div className="absolute left-0 right-0 top-12 max-h-[60vh] overflow-auto rounded-2xl border bg-white p-2 shadow-2xl">{searching?<p className="p-3 text-sm text-slate-500">Đang tìm...</p>:results.length?results.map(r=><button key={r.key} onClick={()=>{setShowSearch(false);setQ("");router.push(r.href)}} className="flex w-full items-start justify-between gap-3 rounded-xl p-3 text-left hover:bg-blue-50"><div><p className="font-semibold text-slate-900">{r.title}</p><p className="text-xs text-slate-500">{r.sub||"Không có thông tin thêm"}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">{r.kind}</span></button>):<p className="p-3 text-sm text-slate-500">Không tìm thấy kết quả.</p>}</div>}</div></div>
   <div className="flex items-center gap-3 sm:gap-5"><div className="relative"><button onClick={()=>setShowNotifications(v=>!v)} className="relative rounded-full p-2 text-gray-500 hover:bg-slate-100" aria-label="Thông báo"><Bell size={20}/>{notificationCount>0&&<span className="absolute right-0 top-0 grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">{Math.min(notificationCount,9)}{notificationCount>9?"+":""}</span>}</button>{showNotifications&&<div className="absolute right-0 top-12 w-[min(92vw,380px)] rounded-2xl border bg-white p-3 shadow-2xl"><div className="mb-2 flex items-center justify-between"><b>Nhắc việc</b><button onClick={()=>setShowNotifications(false)} className="rounded p-1 text-slate-400"><X size={16}/></button></div><div className="max-h-96 space-y-1 overflow-auto">{notifications.length?notifications.map(n=><button key={n.id} onClick={()=>{setShowNotifications(false);router.push(n.href)}} className="w-full rounded-xl p-3 text-left hover:bg-slate-50"><p className="font-semibold">{n.title}</p><p className={`text-xs ${n.type==="debt"?"text-red-600":"text-slate-500"}`}>{n.sub}</p></button>):<p className="p-4 text-center text-sm text-slate-500">Không có việc cần nhắc.</p>}</div></div>}</div><div className="flex items-center gap-2">{brand.avatar?<img src={brand.avatar} alt="Ảnh đại diện" className="h-8 w-8 rounded-full object-cover ring-1 ring-slate-200"/>:<UserCircle2 size={32}/>}<div className="hidden sm:block"><p className="font-semibold leading-tight">{user.full_name}</p><p className="text-xs text-gray-500">{user.role_label}</p></div></div><button onClick={logout} className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-50" title="Đăng xuất"><LogOut size={16} className="sm:hidden"/><span className="hidden sm:inline">Đăng xuất</span></button></div>
 </header>
}
