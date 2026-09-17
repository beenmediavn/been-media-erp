"use client";
import { useEffect,useRef,useState } from "react";
import { UserCircle2,ChevronDown } from "lucide-react";

export default function EmployeePicker({employees,value,onChange,getConflict}:{employees:any[];value:string;onChange:(id:string)=>void;getConflict:(id:string)=>any}){
  const [open,setOpen]=useState(false); const ref=useRef<HTMLDivElement|null>(null);
  const selected=employees.find(e=>e.id===value);
  useEffect(()=>{const fn=(e:MouseEvent)=>{if(ref.current&&!ref.current.contains(e.target as Node))setOpen(false)};document.addEventListener("mousedown",fn);return()=>document.removeEventListener("mousedown",fn)},[]);
  return <div ref={ref} className="relative mt-1">
    <button type="button" onClick={()=>setOpen(v=>!v)} className="flex w-full items-center justify-between gap-2 rounded border bg-white p-2 text-left">
      <span className="flex min-w-0 items-center gap-2">{selected?.avatar_url?<img src={selected.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover"/>:<UserCircle2 className="h-8 w-8 shrink-0 text-slate-400"/>}<span className="truncate">{selected?`${selected.full_name} - ${selected.role}`:"Chọn tên thợ"}</span></span><ChevronDown size={16}/>
    </button>
    {open&&<div className="absolute z-[140] mt-1 max-h-72 w-full overflow-y-auto rounded-xl border bg-white p-1 shadow-2xl">
      <button type="button" onClick={()=>{onChange("");setOpen(false)}} className="w-full rounded-lg p-2 text-left text-sm hover:bg-slate-50">Chưa chọn</button>
      {employees.map(e=>{const c=getConflict(e.id);return <button key={e.id} type="button" disabled={Boolean(c)} onClick={()=>{onChange(e.id);setOpen(false)}} className={`flex w-full items-center gap-3 rounded-lg p-2 text-left ${c?"cursor-not-allowed bg-red-50 opacity-55":"hover:bg-blue-50"}`}>
        {e.avatar_url?<img src={e.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover"/>:<UserCircle2 className="h-10 w-10 shrink-0 text-slate-400"/>}
        <span className="min-w-0"><b className="block truncate">{e.full_name}</b><span className="text-xs text-slate-500">{e.role}{c?` • BẬN ${c.start}-${c.end}`:""}</span></span>
      </button>})}
    </div>}
  </div>
}
