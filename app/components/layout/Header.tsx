"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, CheckCheck, LogOut, Menu, Search, UserCircle2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { clearSession, type AppUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useBranding } from "../useBranding";

const localDate=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const addDays=(n:number)=>{const d=new Date();d.setDate(d.getDate()+n);return localDate(d)};
const money=(v:any)=>Number(v||0).toLocaleString("vi-VN")+" đ";

type SearchResult={key:string;title:string;sub:string;href:string;kind:string};
type AppNotification={id:string;groupId:string;type:"job"|"debt"|"new_job";title:string;sub:string;href:string};

export default function Header({user,onMenuClick}:{user:AppUser;onMenuClick?:()=>void}){
 const router=useRouter(); const brand=useBranding();
 const [q,setQ]=useState(""); const [results,setResults]=useState<SearchResult[]>([]); const [searching,setSearching]=useState(false); const [showSearch,setShowSearch]=useState(false);
 const [notifications,setNotifications]=useState<AppNotification[]>([]); const [showNotifications,setShowNotifications]=useState(false);
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const readKey=`been_media_notification_read_${user.id}`;
 function logout(){clearSession();router.replace("/login")}

 function getReadIds(){
   if(typeof window==="undefined") return new Set<string>();
   try{return new Set<string>(JSON.parse(localStorage.getItem(readKey)||"[]"))}catch{return new Set<string>()}
 }
 function saveReadIds(ids:Set<string>){
   if(typeof window==="undefined") return;
   localStorage.setItem(readKey,JSON.stringify(Array.from(ids).slice(-500)));
 }
 function markRead(n:AppNotification){
   const ids=getReadIds();
   notifications.filter(x=>x.groupId===n.groupId).forEach(x=>ids.add(x.id));
   saveReadIds(ids);
   setNotifications(prev=>prev.filter(x=>x.groupId!==n.groupId));
   setShowNotifications(false);
   router.push(n.href);
 }
 function markAllRead(){
   const ids=getReadIds();
   notifications.forEach(n=>ids.add(n.id));
   saveReadIds(ids);
   setNotifications([]);
 }

 useEffect(()=>{(async()=>{try{
   const today=localDate(),tomorrow=addDays(1);
   const read=getReadIds();
   const list:AppNotification[]=[];

   if(user.role==="admin"){
     const [{data:days},{data:debts}]=await Promise.all([
       supabase.from("job_days").select("id,shooting_date,start_time,jobs(id,event_name,customer_name)").gte("shooting_date",today).lte("shooting_date",tomorrow).order("shooting_date").limit(12),
       supabase.from("jobs").select("id,event_name,customer_name,debt,status").gt("debt",0).order("debt",{ascending:false}).limit(8)
     ]);
     (days||[]).forEach((d:any)=>list.push({
       id:"admin-job-"+d.id,groupId:"admin-job-"+d.id,type:"job",
       title:d.jobs?.event_name||d.jobs?.customer_name||"Job sắp tới",
       sub:`${d.shooting_date===today?"Hôm nay":"Ngày mai"} • ${d.start_time||"--:--"}`,href:"/schedule"
     }));
     (debts||[]).forEach((j:any)=>list.push({
       id:"admin-debt-"+j.id,groupId:"admin-debt-"+j.id,type:"debt",
       title:j.event_name||j.customer_name||"Khách còn nợ",
       sub:`Còn nợ ${money(j.debt)}`,href:"/payments"
     }));
   } else {
     // Nhân sự chỉ nhận thông báo liên quan đúng các job được phân công cho chính mình.
     const {data:assignments,error}=await supabase
       .from("job_assignments")
       .select("id,created_at,role,employee_id,jobs(id,event_name,customer_name,status),job_days(id,shooting_date,start_time,end_time)")
       .eq("employee_id",user.id)
       .order("created_at",{ascending:false})
       .limit(60);
     if(error) throw error;

     const now=Date.now();
     (assignments||[]).forEach((a:any)=>{
       const d=a.job_days?.shooting_date||"";
       const jobName=a.jobs?.event_name||a.jobs?.customer_name||"Job";
       const created=a.created_at?new Date(a.created_at).getTime():0;
       const isNew=created>0 && now-created<=7*24*60*60*1000;
       const isUpcoming=d>=today && d<=tomorrow;

       if(isNew){
         list.push({
           id:"worker-new-"+a.id,groupId:"worker-"+a.id,type:"new_job",
           title:`Job mới: ${jobName}`,
           sub:`${d||"Chưa có ngày"} • ${a.job_days?.start_time||"--:--"} • ${a.role||"Phân công"}`,
           href:"/job"
         });
       }
       if(isUpcoming){
         list.push({
           id:"worker-up-"+a.id,groupId:"worker-"+a.id,type:"job",
           title:`Nhắc lịch: ${jobName}`,
           sub:`${d===today?"Hôm nay":"Ngày mai"} • ${a.job_days?.start_time||"--:--"}-${a.job_days?.end_time||"--:--"} • ${a.role||"Phân công"}`,
           href:"/schedule"
         });
       }
     });
   }

   setNotifications(list.filter(n=>!read.has(n.id)));
 }catch{setNotifications([])}})()},[user.id,user.role]);

 useEffect(()=>{if(timer.current)clearTimeout(timer.current);const term=q.trim();if(term.length<2){setResults([]);setSearching(false);return;}setSearching(true);timer.current=setTimeout(async()=>{try{const safe=term.replace(/[,()]/g," ");const [{data:customers},{data:jobs},{data:employees}]=await Promise.all([
   supabase.from("customers").select("id,full_name,phone,service").or(`full_name.ilike.%${safe}%,phone.ilike.%${safe}%`).limit(5),
   supabase.from("jobs").select("id,event_name,customer_name,customer_phone,status").or(`event_name.ilike.%${safe}%,customer_name.ilike.%${safe}%,customer_phone.ilike.%${safe}%`).limit(5),
   supabase.from("employees").select("id,full_name,phone,role").or(`full_name.ilike.%${safe}%,phone.ilike.%${safe}%`).limit(4)
  ]);const out:SearchResult[]=[];(customers||[]).forEach((x:any)=>out.push({key:"c"+x.id,title:x.full_name||"Khách hàng",sub:[x.phone,x.service].filter(Boolean).join(" • "),href:"/customers",kind:"Khách"}));(jobs||[]).forEach((x:any)=>out.push({key:"j"+x.id,title:x.event_name||x.customer_name||"Job",sub:[x.customer_name,x.status].filter(Boolean).join(" • "),href:`/job?open=${x.id}`,kind:"Job"}));(employees||[]).forEach((x:any)=>out.push({key:"e"+x.id,title:x.full_name||"Nhân sự",sub:[x.role,x.phone].filter(Boolean).join(" • "),href:"/employees",kind:"Nhân sự"}));setResults(out)}catch{setResults([])}finally{setSearching(false)}},280);return()=>{if(timer.current)clearTimeout(timer.current)}},[q]);

 const notificationCount=useMemo(()=>notifications.length,[notifications]);
 return <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-white px-4 text-slate-900 sm:px-6 lg:px-8">
   <div className="relative flex min-w-0 flex-1 items-center gap-3 text-gray-500"><button onClick={onMenuClick} aria-label="Mở menu" className="rounded-lg border p-2 text-slate-700 lg:hidden"><Menu size={20}/></button><div className="relative hidden w-full max-w-xl sm:block"><Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={q} onFocus={()=>setShowSearch(true)} onChange={e=>{setQ(e.target.value);setShowSearch(true)}} placeholder="Tìm khách, SĐT, Job, nhân sự..." className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-9 text-sm text-slate-900 focus:bg-white"/>{q&&<button onClick={()=>{setQ("");setResults([])}} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400"><X size={16}/></button>}{showSearch&&q.trim().length>=2&&<div className="absolute left-0 right-0 top-12 max-h-[60vh] overflow-auto rounded-2xl border bg-white p-2 shadow-2xl">{searching?<p className="p-3 text-sm text-slate-500">Đang tìm...</p>:results.length?results.map(r=><button key={r.key} onClick={()=>{setShowSearch(false);setQ("");router.push(r.href)}} className="flex w-full items-start justify-between gap-3 rounded-xl p-3 text-left hover:bg-blue-50"><div><p className="font-semibold text-slate-900">{r.title}</p><p className="text-xs text-slate-500">{r.sub||"Không có thông tin thêm"}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">{r.kind}</span></button>):<p className="p-3 text-sm text-slate-500">Không tìm thấy kết quả.</p>}</div>}</div></div>
   <div className="flex items-center gap-3 sm:gap-5">
     <div className="relative">
       <button onClick={()=>setShowNotifications(v=>!v)} className="relative rounded-full p-2 text-gray-500 hover:bg-slate-100" aria-label="Thông báo">
         <Bell size={20}/>
         {notificationCount>0&&<span className="absolute right-0 top-0 grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">{Math.min(notificationCount,9)}{notificationCount>9?"+":""}</span>}
       </button>
       {showNotifications&&<>
         <button aria-label="Đóng thông báo" onClick={()=>setShowNotifications(false)} className="fixed inset-0 z-40 bg-black/10 sm:hidden"/>
         <div className="fixed left-3 right-3 top-[72px] z-50 max-h-[70vh] overflow-hidden rounded-2xl border bg-white p-3 shadow-2xl sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-[380px] sm:max-w-[92vw]">
           <div className="mb-2 flex items-center justify-between gap-2">
             <b>{user.role==="admin"?"Nhắc việc":"Thông báo công việc"}</b>
             <div className="flex items-center gap-1">
               {notifications.length>0&&<button onClick={markAllRead} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50"><CheckCheck size={15}/>Đã đọc hết</button>}
               <button onClick={()=>setShowNotifications(false)} className="rounded p-1 text-slate-400"><X size={17}/></button>
             </div>
           </div>
           <div className="max-h-[58vh] space-y-1 overflow-y-auto overscroll-contain pr-1">
             {notifications.length?notifications.map(n=><button key={n.id} onClick={()=>markRead(n)} className="w-full rounded-xl border border-transparent p-3 text-left hover:border-slate-200 hover:bg-slate-50">
               <p className="font-semibold">{n.title}</p>
               <p className={`text-xs ${n.type==="debt"?"text-red-600":n.type==="new_job"?"text-blue-600":"text-slate-500"}`}>{n.sub}</p>
             </button>):<p className="p-5 text-center text-sm text-slate-500">Không có thông báo mới.</p>}
           </div>
         </div>
       </>}
     </div>
     <div className="flex items-center gap-2">{brand.avatar?<img src={brand.avatar} alt="Ảnh đại diện" className="h-8 w-8 rounded-full object-cover ring-1 ring-slate-200"/>:<UserCircle2 size={32}/>}<div className="hidden sm:block"><p className="font-semibold leading-tight">{user.full_name}</p><p className="text-xs text-gray-500">{user.role_label}</p></div></div>
     <button onClick={logout} className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-50" title="Đăng xuất"><LogOut size={16} className="sm:hidden"/><span className="hidden sm:inline">Đăng xuất</span></button>
   </div>
 </header>
}
