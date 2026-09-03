"use client";

import { useEffect, useMemo, useState } from "react";
import MainLayout from "../components/layout/MainLayout";
import EmployeePicker from "../components/EmployeePicker";
import { supabase } from "@/lib/supabase";
import { CalendarDays, Clock3, Plus, Trash2, Users } from "lucide-react";
import { requireEditPin } from "@/lib/admin-pin";

const pad2=(n:number)=>String(n).padStart(2,"0");
const localDateInput=(d=new Date())=>`${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
const formatDate=(v:string)=>{if(!v)return "";const [y,m,d]=v.split("-");return `${d}/${m}/${y}`};
const formatTime=(v?:string|null)=>String(v||"").slice(0,5);

function normalizeRole(value?:string){
  const v=String(value||"").toLowerCase();
  if(v.includes("photo")||v.includes("chụp")||v.includes("chup")) return "Thợ chụp";
  if(v.includes("video")||v.includes("quay")||v.includes("camera")) return "Thợ quay";
  if(v.includes("fly")) return "Flycam";
  if(v.includes("edit")) return "Editor";
  if(v.includes("live")) return "Livestream";
  if(v.includes("make")) return "Makeup";
  if(v.includes("lái")||v.includes("lai xe")||v.includes("driver")) return "Lái xe";
  return value||"Thợ chụp";
}

type StatusFilter="reserved"|"used"|"all";

export default function ReserveWorkersPage(){
  const today=localDateInput();
  const [employees,setEmployees]=useState<any[]>([]);
  const [rows,setRows]=useState<any[]>([]);
  const [reserveDate,setReserveDate]=useState(today);
  const [viewDate,setViewDate]=useState("");
  const [startTime,setStartTime]=useState("");
  const [endTime,setEndTime]=useState("");
  const [employeeId,setEmployeeId]=useState("");
  const [role,setRole]=useState("Thợ chụp");
  const [note,setNote]=useState("");
  const [statusFilter,setStatusFilter]=useState<StatusFilter>("reserved");
  const [saving,setSaving]=useState(false);

  async function load(){
    const [{data:emp,error:empError},{data:res,error}]=await Promise.all([
      supabase.from("employees").select("*").eq("active",true).order("full_name"),
      supabase.from("reserve_workers").select("*, employees(*)").order("reserve_date").order("start_time",{ascending:true,nullsFirst:true})
    ]);
    if(empError){alert(`Không tải được nhân sự: ${empError.message}`);return}
    if(error){alert(`Không tải được thợ dự phòng: ${error.message}\nNếu vừa nâng V8.3.7, hãy chạy file UPDATE_V8_3_6_RESERVE_TIME_STATUS.sql trong Supabase.`);return}
    setEmployees(emp||[]);setRows(res||[]);
  }
  useEffect(()=>{load()},[]);

  async function save(){
    if(!reserveDate)return alert("Chọn ngày dự phòng");
    if(!employeeId)return alert("Chọn thợ dự phòng");
    if(startTime&&endTime&&endTime<=startTime)return alert("Giờ kết thúc phải lớn hơn giờ bắt đầu");
    setSaving(true);
    try{
      let query=supabase.from("reserve_workers").select("id").eq("reserve_date",reserveDate).eq("employee_id",employeeId).eq("status","reserved");
      if(startTime) query=query.eq("start_time",startTime); else query=query.is("start_time",null);
      const {data:existing,error:findError}=await query.limit(1);
      if(findError) throw findError;
      const payload={
        reserve_date:reserveDate,
        start_time:startTime||null,
        end_time:endTime||null,
        employee_id:employeeId,
        role,
        note,
        status:"reserved",
        assigned_job_id:null,
        assigned_at:null,
      };
      if(existing?.length){
        const {error}=await supabase.from("reserve_workers").update(payload).eq("id",existing[0].id);
        if(error)throw error;
      }else{
        const {error}=await supabase.from("reserve_workers").insert(payload);
        if(error)throw error;
      }
      setStatusFilter("reserved");
      await load();
      alert(`Đã chốt ${employees.find(e=>e.id===employeeId)?.full_name||"nhân sự"} ngày ${formatDate(reserveDate)}${startTime?` • ${startTime}${endTime?`–${endTime}`:""}`:" • cả ngày"}`);
      setNote("");
    }catch(err:any){alert(`Không lưu được thợ dự phòng: ${err?.message||String(err)}`)}finally{setSaving(false)}
  }

  async function remove(id:string){
    if(!(await requireEditPin("xóa thợ dự phòng")))return;
    if(!confirm("Bỏ thợ này khỏi danh sách dự phòng?"))return;
    const {error}=await supabase.from("reserve_workers").delete().eq("id",id);
    if(error)return alert(error.message);
    load();
  }

  const visibleRows=useMemo(()=>rows.filter((r:any)=>{
    if(viewDate && r.reserve_date!==viewDate)return false;
    if(statusFilter==="all")return r.status!=="cancelled";
    return r.status===statusFilter;
  }).sort((a:any,b:any)=>String(a.reserve_date).localeCompare(String(b.reserve_date)) || String(a.start_time||"").localeCompare(String(b.start_time||""))),[rows,viewDate,statusFilter]);

  const activeCount=rows.filter((r:any)=>(!viewDate||r.reserve_date===viewDate)&&r.status==="reserved").length;
  const usedCount=rows.filter((r:any)=>(!viewDate||r.reserve_date===viewDate)&&r.status==="used").length;
  const groupedRows=useMemo(()=>{
    const groups=new Map<string,any[]>();
    for(const r of visibleRows){const key=r.reserve_date||""; if(!groups.has(key))groups.set(key,[]); groups.get(key)!.push(r)}
    return Array.from(groups.entries());
  },[visibleRows]);

  return <MainLayout><div className="mx-auto max-w-6xl space-y-5">
    <div><h1 className="text-2xl font-bold sm:text-3xl">Thợ dự phòng</h1><p className="text-sm text-slate-500">Mỗi lần chốt 1 ngày. Giờ là tùy chọn; không nhập giờ nghĩa là giữ thợ cả ngày. Khi đã đưa vào Job, thợ chuyển sang “Đã xếp Job” và không còn nằm trong danh sách đang dự phòng.</p></div>

    <div className="rounded-2xl bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-center gap-2 font-bold"><Plus size={20}/> Chốt thợ dự phòng</div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <label className="text-sm text-slate-600">Ngày <span className="text-red-500">*</span><input type="date" value={reserveDate} onChange={e=>setReserveDate(e.target.value)} className="mt-1 w-full rounded-xl border p-3"/></label>
        <label className="text-sm text-slate-600">Giờ bắt đầu <span className="text-slate-400">(tùy chọn)</span><input type="time" value={startTime} onChange={e=>setStartTime(e.target.value)} className="mt-1 w-full rounded-xl border p-3"/></label>
        <label className="text-sm text-slate-600">Giờ kết thúc <span className="text-slate-400">(tùy chọn)</span><input type="time" value={endTime} onChange={e=>setEndTime(e.target.value)} className="mt-1 w-full rounded-xl border p-3"/></label>
        <label className="text-sm text-slate-600">Chọn thợ<EmployeePicker employees={employees} value={employeeId} onChange={(id)=>{setEmployeeId(id);const emp=employees.find(x=>x.id===id);if(emp?.role)setRole(normalizeRole(emp.role));}} getConflict={()=>null}/></label>
        <label className="text-sm text-slate-600">Vai trò<select value={role} onChange={e=>setRole(e.target.value)} className="mt-1 w-full rounded-xl border p-3"><option>Thợ chụp</option><option>Thợ quay</option><option>Flycam</option><option>Editor</option><option>Livestream</option><option>Makeup</option><option>Lái xe</option></select></label>
        <button onClick={save} disabled={saving} className="self-end rounded-xl bg-blue-600 p-3 font-bold text-white disabled:opacity-50">{saving?"Đang lưu...":"+ Chốt dự phòng"}</button>
      </div>
      <input value={note} onChange={e=>setNote(e.target.value)} className="mt-3 w-full rounded-xl border p-3" placeholder="Ghi chú: ưu tiên job cưới, đã chốt riêng với thợ..."/>
    </div>

    <div className="rounded-2xl bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <button onClick={()=>setViewDate("")} className={`rounded-xl px-4 py-3 text-sm font-bold ${!viewDate?"bg-blue-600 text-white":"border bg-white"}`}>Tất cả ngày</button>
          <label className="text-sm font-semibold text-slate-700">Lọc theo ngày<input type="date" value={viewDate} onChange={e=>setViewDate(e.target.value)} className="mt-1 block rounded-xl border p-3"/></label>
          {viewDate&&<button onClick={()=>setViewDate("")} className="rounded-xl border bg-white px-4 py-3 text-sm font-bold">Bỏ lọc ngày</button>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={()=>setStatusFilter("reserved")} className={`rounded-full px-4 py-2 text-sm font-bold ${statusFilter==="reserved"?"bg-blue-600 text-white":"border bg-white"}`}>Đang dự phòng ({activeCount})</button>
          <button onClick={()=>setStatusFilter("used")} className={`rounded-full px-4 py-2 text-sm font-bold ${statusFilter==="used"?"bg-emerald-600 text-white":"border bg-white"}`}>Đã xếp Job ({usedCount})</button>
          <button onClick={()=>setStatusFilter("all")} className={`rounded-full px-4 py-2 text-sm font-bold ${statusFilter==="all"?"bg-slate-800 text-white":"border bg-white"}`}>Tất cả</button>
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2"><CalendarDays size={20} className="text-blue-600"/><b>{viewDate?`Ngày ${formatDate(viewDate)}`:"Tất cả ngày đã chốt"}</b></div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{visibleRows.length} người</span></div>
      {visibleRows.length>0?<div className="space-y-5">{groupedRows.map(([date,items])=><section key={date}><div className="mb-2 flex items-center gap-2 border-b pb-2"><CalendarDays size={17} className="text-blue-600"/><h3 className="font-extrabold">{formatDate(date)}</h3><span className="text-xs text-slate-400">({items.length} người)</span></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{items.map((r:any)=><div key={r.id} className={`flex items-center justify-between rounded-xl border p-3 ${r.status==="used"?"bg-emerald-50/60":"bg-white"}`}><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-bold">{r.employees?.full_name||"Nhân sự"}</p>{r.status==="used"&&<span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">Đã xếp Job</span>}</div><p className="text-sm text-slate-500">{r.role}</p><p className="mt-1 flex items-center gap-1 text-xs font-semibold text-slate-600"><Clock3 size={13}/>{r.start_time?`${formatTime(r.start_time)}${r.end_time?` – ${formatTime(r.end_time)}`:""}`:"Cả ngày"}</p>{r.status==="used"&&r.assigned_job_id&&<p className="mt-1 text-xs font-semibold text-emerald-700">Đã gắn với Job</p>}{r.note&&<p className="mt-1 truncate text-xs text-slate-400">{r.note}</p>}</div><button onClick={()=>remove(r.id)} className="rounded-lg p-2 text-red-600 hover:bg-red-50" title="Xóa bản ghi"><Trash2 size={18}/></button></div>)}</div></section>)}</div>:<div className="rounded-2xl border-2 border-dashed py-12 text-center text-slate-500"><Users className="mx-auto mb-2"/>{viewDate?"Ngày này chưa có thợ phù hợp bộ lọc.":"Chưa có thợ dự phòng phù hợp bộ lọc."}</div>}
    </div>
  </div></MainLayout>
}
