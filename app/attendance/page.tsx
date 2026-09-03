"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import MainLayout from "../components/layout/MainLayout";
import { getSession, type AppUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { Camera, CheckCircle2, Clock3, Image as ImageIcon, LogIn, LogOut, RefreshCcw, UserRound, X } from "lucide-react";
import { formatDateTimeVN, formatDateVN } from "@/lib/date-vn";

const localDate=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const isDone=(s:any)=>String(s||"").toLowerCase().includes("hoàn thành")||String(s||"").toLowerCase().includes("đã bàn giao");

type CaptureMode="checkin_face"|"checkin_customer"|"checkout";

export default function AttendancePage(){
  const [user,setUser]=useState<AppUser|null>(null);
  useEffect(()=>setUser(getSession()),[]);
  if(!user)return <MainLayout><div className="p-6">Đang tải...</div></MainLayout>;
  return <MainLayout><AttendanceApp user={user}/></MainLayout>;
}

function AttendanceApp({user}:{user:AppUser}){
  const admin=user.role==="admin";
  const [date,setDate]=useState(localDate());
  const [assignments,setAssignments]=useState<any[]>([]);
  const [records,setRecords]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [capture,setCapture]=useState<{mode:CaptureMode;assignment:any}|null>(null);

  async function load(){
    setLoading(true);
    let q=supabase.from("job_assignments").select("*,employees(id,full_name,role),jobs(id,event_name,customer_name,status,service),job_days(id,shooting_date,start_time,end_time,location)").order("created_at",{ascending:true});
    if(!admin) q=q.eq("employee_id",user.id);
    const [{data:ass,error},{data:att}]=await Promise.all([
      q,
      admin?supabase.from("attendance_records").select("*,employees(full_name,role),jobs(event_name,customer_name,service),job_days(shooting_date,start_time,end_time)").order("check_in_at",{ascending:false}):supabase.from("attendance_records").select("*").eq("employee_id",user.id).order("check_in_at",{ascending:false})
    ]);
    if(error&&navigator.onLine)alert(error.message);
    setAssignments((ass||[]).filter((a:any)=>a.job_days?.shooting_date===date));
    setRecords(att||[]);
    setLoading(false);
  }
  useEffect(()=>{load()},[date,user.id,user.role]);

  const recordByAssignment=useMemo(()=>new Map(records.map((r:any)=>[r.assignment_id,r])),[records]);
  const visibleRecords=useMemo(()=>records.filter((r:any)=>r.job_days?.shooting_date? r.job_days.shooting_date===date : assignments.some((a:any)=>a.id===r.assignment_id)),[records,assignments,date]);

  function openCapture(mode:CaptureMode,a:any){
    if(mode==="checkout"){
      const r=recordByAssignment.get(a.id);
      if(!r?.check_in_at){alert("Thợ phải Check-in trước khi Check-out.");return;}
      if(!r?.check_in_customer_url && !confirm("Bạn chưa gửi ảnh Check-in cùng khách hàng. Vẫn tiếp tục Check-out? Admin sẽ thấy cảnh báo thiếu ảnh."))return;
    }
    setCapture({mode,assignment:a});
  }

  async function saveCapture(blob:Blob,mode:CaptureMode,a:any){
    const ext="jpg";
    const filename=`${a.employee_id}/${a.job_id}/${a.id}/${Date.now()}-${mode}.${ext}`;
    const {error:upErr}=await supabase.storage.from("attendance").upload(filename,blob,{contentType:"image/jpeg",upsert:false});
    if(upErr){alert("Không tải được ảnh chấm công: "+upErr.message);return false;}
    const {data:urlData}=supabase.storage.from("attendance").getPublicUrl(filename);
    const url=urlData.publicUrl;
    const now=new Date();
    const existing=recordByAssignment.get(a.id);
    if(mode==="checkin_face"){
      const start=a.job_days?.start_time;
      let late=0;
      if(start){const [h,m]=String(start).split(":").map(Number);const scheduled=new Date(`${a.job_days.shooting_date}T${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:00`);late=Math.max(Math.floor((now.getTime()-scheduled.getTime())/60000),0);}
      const payload={assignment_id:a.id,job_id:a.job_id,job_day_id:a.job_day_id,employee_id:a.employee_id,check_in_at:now.toISOString(),check_in_face_url:url,late_minutes:late,status:late>0?"checked_in_late":"checked_in"};
      const {error}=existing?await supabase.from("attendance_records").update(payload).eq("id",existing.id):await supabase.from("attendance_records").insert([payload]);
      if(error){alert(error.message);return false;}
      alert("Đã CHECK-IN. Admin đã có thể thấy giờ và ảnh Check-in.\n\nTiếp theo: hãy chụp ảnh bạn cùng cô dâu chú rể / khách hàng để gửi về Studio.");
    }else if(mode==="checkin_customer"){
      if(!existing){alert("Hãy Check-in khuôn mặt trước.");return false;}
      const {error}=await supabase.from("attendance_records").update({check_in_customer_url:url,status:"customer_photo_done"}).eq("id",existing.id);
      if(error){alert(error.message);return false;}
      alert("Đã gửi ảnh xác nhận cùng khách về Studio.");
    }else{
      if(!existing){alert("Không tìm thấy lượt Check-in.");return false;}
      const {error}=await supabase.from("attendance_records").update({check_out_at:now.toISOString(),check_out_photo_url:url,status:"checked_out"}).eq("id",existing.id);
      if(error){alert(error.message);return false;}
      alert("Đã CHECK-OUT và gửi ảnh hoàn thành Job về Studio.");
    }
    setCapture(null);await load();return true;
  }

  return <div className="mx-auto max-w-7xl">
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><h1 className="text-2xl font-black sm:text-3xl">CHẤM CÔNG</h1><p className="text-sm text-slate-500">Check-in / Check-out bằng camera, lưu ảnh xác nhận theo từng Job.</p></div>
      <label className="text-sm font-semibold">Ngày<input type="date" value={date} onChange={e=>setDate(e.target.value)} className="ml-2 rounded-xl border bg-white p-2"/></label>
    </div>

    {admin?<AdminView assignments={assignments} records={visibleRecords} recordByAssignment={recordByAssignment}/>:<WorkerView assignments={assignments} recordByAssignment={recordByAssignment} openCapture={openCapture}/>}    
    {loading&&<div className="mt-4 rounded-2xl bg-white p-6 text-center text-slate-500">Đang tải chấm công...</div>}
    {capture&&<CameraCapture mode={capture.mode} assignment={capture.assignment} onClose={()=>setCapture(null)} onCapture={(blob)=>saveCapture(blob,capture.mode,capture.assignment)}/>}  
  </div>;
}

function WorkerView({assignments,recordByAssignment,openCapture}:{assignments:any[];recordByAssignment:Map<any,any>;openCapture:(m:CaptureMode,a:any)=>void}){
  if(!assignments.length)return <div className="rounded-3xl bg-white p-8 text-center text-slate-500">Hôm nay bạn chưa có Job được phân công.</div>;
  return <div className="space-y-4">{assignments.map(a=>{const r=recordByAssignment.get(a.id);return <div key={a.id} className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold">{a.jobs?.event_name||a.jobs?.customer_name||"Job"}</h2><p className="text-sm text-slate-500">{formatDateVN(a.job_days?.shooting_date)} • {a.job_days?.start_time||"--:--"} - {a.job_days?.end_time||"--:--"} • {a.role}</p></div><AttendanceBadge r={r}/></div>
    <div className="mt-4 grid gap-3 lg:grid-cols-3">
      <Step title="1. CHECK-IN KHUÔN MẶT" done={!!r?.check_in_face_url} text={r?.check_in_at?`Đã Check-in ${formatDateTimeVN(r.check_in_at)}${r.late_minutes>0?` • Muộn ${r.late_minutes} phút`:" • Đúng giờ"}`:"Đến Job → chụp ảnh khuôn mặt để Check-in."} photo={r?.check_in_face_url}><button disabled={!!r?.check_in_at} onClick={()=>openCapture("checkin_face",a)} className="w-full rounded-xl bg-blue-600 px-4 py-3 font-bold text-white disabled:bg-slate-300"><LogIn className="mr-2 inline" size={18}/>{r?.check_in_at?"Đã Check-in":"Mở camera Check-in"}</button></Step>
      <Step title="2. ẢNH CÙNG KHÁCH" done={!!r?.check_in_customer_url} warn={!!r?.check_in_at&&!r?.check_in_customer_url} text={r?.check_in_customer_url?"Đã gửi ảnh cùng khách về Studio.":"Sau Check-in, hãy chụp ảnh bạn cùng cô dâu chú rể / khách hàng."} photo={r?.check_in_customer_url}><button disabled={!r?.check_in_at||!!r?.check_in_customer_url} onClick={()=>openCapture("checkin_customer",a)} className="w-full rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white disabled:bg-slate-300"><Camera className="mr-2 inline" size={18}/>{r?.check_in_customer_url?"Đã gửi ảnh":"Chụp ảnh cùng khách"}</button></Step>
      <Step title="3. CHECK-OUT" done={!!r?.check_out_photo_url} warn={!!r?.check_in_at&&!r?.check_out_photo_url} text={r?.check_out_at?`Hoàn thành ${formatDateTimeVN(r.check_out_at)}`:"Khi xong Job, chụp ảnh bạn cùng không gian làm việc hoặc khách hàng để Check-out."} photo={r?.check_out_photo_url}><button disabled={!r?.check_in_at||!!r?.check_out_at} onClick={()=>openCapture("checkout",a)} className="w-full rounded-xl bg-orange-600 px-4 py-3 font-bold text-white disabled:bg-slate-300"><LogOut className="mr-2 inline" size={18}/>{r?.check_out_at?"Đã Check-out":"Check-out hoàn thành Job"}</button></Step>
    </div>
  </div>})}</div>;
}

function AdminView({assignments,records,recordByAssignment}:{assignments:any[];records:any[];recordByAssignment:Map<any,any>}){
  const checked=assignments.filter(a=>recordByAssignment.get(a.id)?.check_in_at).length;
  const done=assignments.filter(a=>recordByAssignment.get(a.id)?.check_out_at).length;
  const missingCustomer=assignments.filter(a=>{const r=recordByAssignment.get(a.id);return r?.check_in_at&&!r?.check_in_customer_url}).length;
  return <>
    <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4"><Stat label="Lượt phải đi Job" value={assignments.length}/><Stat label="Đã Check-in" value={checked}/><Stat label="Đã Check-out" value={done}/><Stat label="Thiếu ảnh cùng khách" value={missingCustomer} warn/></div>
    <div className="space-y-3">{assignments.map(a=>{const r=recordByAssignment.get(a.id);return <div key={a.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100"><div className="flex flex-wrap items-start justify-between gap-2"><div><b>{a.employees?.full_name||"Nhân sự"}</b><p className="text-sm text-slate-500">{a.jobs?.event_name||a.jobs?.customer_name||"Job"} • {a.role} • {a.job_days?.start_time||"--:--"}-{a.job_days?.end_time||"--:--"}</p></div><AttendanceBadge r={r}/></div><div className="mt-3 grid gap-3 sm:grid-cols-3"><AdminPhoto title="Ảnh mặt Check-in" url={r?.check_in_face_url} time={r?.check_in_at}/><AdminPhoto title="Ảnh cùng khách" url={r?.check_in_customer_url} warn={!!r?.check_in_at&&!r?.check_in_customer_url}/><AdminPhoto title="Ảnh Check-out" url={r?.check_out_photo_url} time={r?.check_out_at} warn={!!r?.check_in_at&&!r?.check_out_photo_url}/></div>{r?.late_minutes>0&&<p className="mt-2 text-sm font-bold text-red-600">Đi muộn {r.late_minutes} phút</p>}</div>})}{!assignments.length&&<div className="rounded-3xl bg-white p-8 text-center text-slate-500">Không có nhân sự phải đi Job trong ngày này.</div>}</div>
  </>;
}

function CameraCapture({mode,assignment,onClose,onCapture}:{mode:CaptureMode;assignment:any;onClose:()=>void;onCapture:(b:Blob)=>Promise<boolean>}){
  const videoRef=useRef<HTMLVideoElement|null>(null);const canvasRef=useRef<HTMLCanvasElement|null>(null);const streamRef=useRef<MediaStream|null>(null);
  const [facing,setFacing]=useState<"user"|"environment">(mode==="checkin_customer"?"environment":"user");const [saving,setSaving]=useState(false);const [error,setError]=useState("");
  async function start(){try{streamRef.current?.getTracks().forEach(t=>t.stop());const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:facing},audio:false});streamRef.current=stream;if(videoRef.current){videoRef.current.srcObject=stream;await videoRef.current.play();}}catch(e:any){setError("Không mở được camera. Hãy cấp quyền Camera cho trình duyệt hoặc dùng HTTPS/localhost.");}}
  useEffect(()=>{start();return()=>streamRef.current?.getTracks().forEach(t=>t.stop())},[facing]);
  async function snap(){const v=videoRef.current,c=canvasRef.current;if(!v||!c||!v.videoWidth)return;setSaving(true);c.width=v.videoWidth;c.height=v.videoHeight;c.getContext("2d")?.drawImage(v,0,0);c.toBlob(async blob=>{if(!blob){setSaving(false);return;}await onCapture(blob);setSaving(false)},"image/jpeg",0.82)}
  const copy=mode==="checkin_face"?"Chụp rõ khuôn mặt bạn để CHECK-IN":mode==="checkin_customer"?"Hãy chụp ảnh bạn cùng cô dâu chú rể / khách hàng để gửi về Studio":"Hãy chụp ảnh BẠN cùng không gian làm việc hoặc khách hàng để CHECK-OUT hoàn thành Job";
  return <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-3"><div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white"><div className="flex items-start justify-between gap-3 p-4"><div><h2 className="text-lg font-black">📸 {mode==="checkout"?"ẢNH CHECK-OUT":"ẢNH CHECK-IN"}</h2><p className="mt-1 text-sm font-semibold text-blue-700">{copy}</p><p className="text-xs text-slate-500">{assignment.jobs?.event_name||assignment.jobs?.customer_name||"Job"}</p></div><button onClick={onClose} className="rounded-xl border p-2"><X/></button></div><div className="bg-black"><video ref={videoRef} playsInline muted className="mx-auto max-h-[60vh] w-full object-contain"/><canvas ref={canvasRef} className="hidden"/></div>{error&&<p className="p-3 text-sm font-semibold text-red-600">{error}</p>}<div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3"><button onClick={()=>setFacing(v=>v==="user"?"environment":"user")} className="rounded-xl border px-3 py-3 font-semibold"><RefreshCcw className="mr-2 inline" size={17}/>Đổi camera</button><button disabled={saving||!!error} onClick={snap} className="col-span-1 rounded-xl bg-blue-600 px-3 py-3 font-black text-white disabled:bg-slate-400 sm:col-span-2"><Camera className="mr-2 inline" size={18}/>{saving?"Đang gửi về Studio...":"CHỤP & XÁC NHẬN"}</button></div></div></div>;
}

function AttendanceBadge({r}:{r:any}){if(!r?.check_in_at)return <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">Chưa Check-in</span>;if(r.check_out_at)return <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">✓ Đã Check-out</span>;if(!r.check_in_customer_url)return <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">⚠ Thiếu ảnh cùng khách</span>;return <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">Đang ở Job</span>}
function Step({title,done,warn=false,text,photo,children}:{title:string;done:boolean;warn?:boolean;text:string;photo?:string;children:any}){return <div className={`rounded-2xl border p-3 ${done?"border-emerald-200 bg-emerald-50":warn?"border-amber-300 bg-amber-50":"bg-slate-50"}`}><div className="mb-2 flex items-center gap-2 font-black">{done?<CheckCircle2 className="text-emerald-600" size={19}/>:<Clock3 size={19}/>} {title}</div>{photo&&<img src={photo} alt={title} className="mb-3 h-36 w-full rounded-xl object-cover"/>}<p className="mb-3 min-h-10 text-xs text-slate-600">{text}</p>{children}</div>}
function AdminPhoto({title,url,time,warn=false}:{title:string;url?:string;time?:string;warn?:boolean}){return <div className={`rounded-xl border p-2 ${warn?"border-amber-300 bg-amber-50":"bg-slate-50"}`}><p className="mb-2 text-xs font-bold">{title}</p>{url?<a href={url} target="_blank" rel="noreferrer"><img src={url} alt={title} className="h-28 w-full rounded-lg object-cover"/></a>:<div className="grid h-28 place-items-center rounded-lg bg-slate-100 text-xs text-slate-400"><ImageIcon size={24}/><span>{warn?"THIẾU ẢNH":"Chưa có"}</span></div>}{time&&<p className="mt-1 text-[10px] text-slate-500">{formatDateTimeVN(time)}</p>}</div>}
function Stat({label,value,warn=false}:{label:string;value:number;warn?:boolean}){return <div className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ${warn&&value>0?"ring-amber-300":"ring-slate-100"}`}><p className="text-xs text-slate-500">{label}</p><b className={`text-2xl ${warn&&value>0?"text-amber-600":"text-slate-900"}`}>{value}</b></div>}
