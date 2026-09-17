"use client";

import { useEffect, useMemo, useState } from "react";
import MainLayout from "../components/layout/MainLayout";
import { supabase } from "@/lib/supabase";
import { CalendarDays, Plus, Trash2, Users } from "lucide-react";
import { requireEditPin } from "@/lib/admin-pin";

const formatDate=(v:string)=>{if(!v)return "";const [y,m,d]=v.split("-");return `${d}/${m}/${y}`};
const eachDate=(from:string,to:string)=>{const out:string[]=[];if(!from)return out;const start=new Date(`${from}T00:00:00`);const end=new Date(`${(to||from)}T00:00:00`);for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1))out.push(new Date(d).toISOString().slice(0,10));return out};

export default function ReserveWorkersPage(){
  const today=new Date().toISOString().slice(0,10);
  const [employees,setEmployees]=useState<any[]>([]);
  const [rows,setRows]=useState<any[]>([]);
  const [from,setFrom]=useState(today);
  const [to,setTo]=useState(today);
  const [employeeId,setEmployeeId]=useState("");
  const [role,setRole]=useState("Thợ chụp");
  const [note,setNote]=useState("");
  const [saving,setSaving]=useState(false);

  async function load(){
    const [{data:emp},{data:res,error}]=await Promise.all([
      supabase.from("employees").select("*").eq("active",true).order("full_name"),
      supabase.from("reserve_workers").select("*, employees(*)").gte("reserve_date",new Date(Date.now()-7*86400000).toISOString().slice(0,10)).order("reserve_date")
    ]);
    if(error){alert(error.message);return}
    setEmployees(emp||[]);setRows(res||[]);
  }
  useEffect(()=>{load()},[]);

  async function save(){
    if(!employeeId)return alert("Chọn thợ dự phòng");
    const dates=eachDate(from,to);
    if(!dates.length)return alert("Chọn ngày dự phòng");
    setSaving(true);
    const payload=dates.map(reserve_date=>({reserve_date,employee_id:employeeId,role,note,status:"reserved"}));
    const {error}=await supabase.from("reserve_workers").upsert(payload,{onConflict:"reserve_date,employee_id"});
    setSaving(false);
    if(error)return alert(error.message);
    setNote("");await load();
  }
  async function remove(id:string){if(!(await requireEditPin("xóa thợ dự phòng")))return;if(!confirm("Bỏ thợ này khỏi danh sách dự phòng?"))return;const {error}=await supabase.from("reserve_workers").delete().eq("id",id);if(error)return alert(error.message);load()}

  const grouped=useMemo(()=>rows.reduce((m:Record<string,any[]>,r:any)=>{(m[r.reserve_date]??=[]).push(r);return m},{}),[rows]);

  return <MainLayout><div className="mx-auto max-w-6xl space-y-5">
    <div><h1 className="text-2xl font-bold sm:text-3xl">Thợ dự phòng</h1><p className="text-sm text-slate-500">Giữ trước thợ cho ngày cao điểm. Khi tạo Job đúng ngày, app sẽ gợi ý để thêm thợ vào Job chỉ bằng 1 chạm.</p></div>

    <div className="rounded-2xl bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-center gap-2 font-bold"><Plus size={20}/> Chốt thợ dự phòng</div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
        <label className="text-sm text-slate-600">Từ ngày<input type="date" value={from} onChange={e=>{setFrom(e.target.value);if(!to||e.target.value>to)setTo(e.target.value)}} className="mt-1 w-full rounded-xl border p-3"/></label>
        <label className="text-sm text-slate-600">Đến ngày<input type="date" value={to} min={from} onChange={e=>setTo(e.target.value)} className="mt-1 w-full rounded-xl border p-3"/></label>
        <label className="text-sm text-slate-600">Chọn thợ<select value={employeeId} onChange={e=>{setEmployeeId(e.target.value);const emp=employees.find(x=>x.id===e.target.value);if(emp?.role)setRole(emp.role)}} className="mt-1 w-full rounded-xl border p-3"><option value="">-- Chọn thợ --</option>{employees.map(e=><option key={e.id} value={e.id}>{e.full_name} - {e.role}</option>)}</select></label>
        <label className="text-sm text-slate-600">Vai trò<select value={role} onChange={e=>setRole(e.target.value)} className="mt-1 w-full rounded-xl border p-3"><option>Thợ chụp</option><option>Thợ quay</option><option>Flycam</option><option>Editor</option><option>Livestream</option><option>Makeup</option><option>Lái xe</option></select></label>
        <button onClick={save} disabled={saving} className="self-end rounded-xl bg-blue-600 p-3 font-bold text-white disabled:opacity-50">{saving?"Đang lưu...":"+ Chốt dự phòng"}</button>
      </div>
      <input value={note} onChange={e=>setNote(e.target.value)} className="mt-3 w-full rounded-xl border p-3" placeholder="Ghi chú: đã chốt 2 ngày cao điểm, ưu tiên job cưới..."/>
    </div>

    <div className="space-y-4">{Object.keys(grouped).sort().map(date=><div key={date} className="rounded-2xl bg-white p-4 shadow-sm sm:p-5"><div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2"><CalendarDays size={20} className="text-blue-600"/><b>{formatDate(date)}</b></div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{grouped[date].length} thợ dự phòng</span></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{grouped[date].map((r:any)=><div key={r.id} className="flex items-center justify-between rounded-xl border p-3"><div className="min-w-0"><p className="font-bold">{r.employees?.full_name||"Nhân sự"}</p><p className="text-sm text-slate-500">{r.role}</p>{r.note&&<p className="mt-1 truncate text-xs text-slate-400">{r.note}</p>}</div><button onClick={()=>remove(r.id)} className="rounded-lg p-2 text-red-600 hover:bg-red-50" title="Bỏ dự phòng"><Trash2 size={18}/></button></div>)}</div></div>)}{rows.length===0&&<div className="rounded-2xl border-2 border-dashed bg-white py-12 text-center text-slate-500"><Users className="mx-auto mb-2"/>Chưa chốt thợ dự phòng.</div>}</div>
  </div></MainLayout>
}
