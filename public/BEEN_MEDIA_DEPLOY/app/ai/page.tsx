"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import MainLayout from "../components/layout/MainLayout";
import { supabase } from "@/lib/supabase";
import { Bot, Sparkles, WandSparkles, MessageCircleQuestion, ArrowRight, RefreshCw, AlertTriangle } from "lucide-react";
import { formatDateVN } from "@/lib/date-vn";

const money=(v:any)=>Number(v||0).toLocaleString("vi-VN")+" đ";

export default function AiPage(){
 const router=useRouter();
 const [tab,setTab]=useState<"job"|"ask">("job");
 const [message,setMessage]=useState("");
 const [question,setQuestion]=useState("");
 const [employees,setEmployees]=useState<any[]>([]);
 const [preview,setPreview]=useState<any>(null);
 const [answer,setAnswer]=useState("");
 const [loading,setLoading]=useState(false);
 const [configured,setConfigured]=useState<boolean|null>(null);
 const [model,setModel]=useState("");

 useEffect(()=>{
   fetch("/api/ai").then(r=>r.json()).then(x=>{setConfigured(Boolean(x.configured));setModel(x.model||"")}).catch(()=>setConfigured(false));
   supabase.from("employees").select("id,full_name,role").eq("active",true).order("full_name").then(({data})=>setEmployees(data||[]));
 },[]);

 async function parseJob(){
   if(!message.trim()) return alert("Hãy dán tin nhắn của khách trước.");
   setLoading(true);setPreview(null);
   try{
     const r=await fetch("/api/ai",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mode:"parse_job",message,employees:employees.map(e=>({name:e.full_name,role:e.role}))})});
     const x=await r.json(); if(!r.ok) throw new Error(x.error||"Không xử lý được"); setPreview(x.data);
   }catch(e:any){alert(e.message)}finally{setLoading(false)}
 }

 async function buildContext(){
   const [jobs,tx,payments,salary,advances]=await Promise.all([
     supabase.from("jobs").select("id,job_code,event_name,service,total_price,deposit,debt,status,customer_name,customer_phone,customers(full_name,phone),job_days(shooting_date,start_time,end_time,location,job_assignments(role,salary_amount,client_requested,employees(full_name)))").order("created_at",{ascending:false}).limit(120),
     supabase.from("finance_transactions").select("transaction_date,transaction_type,amount,category,description").order("transaction_date",{ascending:false}).limit(250),
     supabase.from("customer_payments").select("payment_date,amount,payment_type,job_id").order("payment_date",{ascending:false}).limit(200),
     supabase.from("salary_payments").select("payment_date,amount,employee_id").order("payment_date",{ascending:false}).limit(200),
     supabase.from("salary_advances").select("advance_date,amount,employee_id").order("advance_date",{ascending:false}).limit(200),
   ]);
   return {today:new Date().toISOString().slice(0,10),jobs:jobs.data||[],finance_transactions:tx.data||[],customer_payments:payments.data||[],salary_payments:salary.data||[],salary_advances:advances.data||[],employees:employees.map(e=>({id:e.id,name:e.full_name,role:e.role}))};
 }

 async function ask(){
   if(!question.trim()) return alert("Hãy nhập câu hỏi.");
   setLoading(true);setAnswer("");
   try{const context=await buildContext();const r=await fetch("/api/ai",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mode:"ask",question,context})});const x=await r.json();if(!r.ok)throw new Error(x.error||"Không hỏi được AI");setAnswer(x.answer||"");}catch(e:any){alert(e.message)}finally{setLoading(false)}
 }

 function openJobDraft(){
   if(!preview)return;
   localStorage.setItem("been_ai_job_draft",JSON.stringify(preview));
   router.push("/job?ai=1");
 }
 const requested=useMemo(()=>preview?.assignments?.filter((a:any)=>a.client_requested)||[],[preview]);
 return <MainLayout><div className="mx-auto max-w-6xl">
  <div className="mb-6 flex flex-wrap items-start justify-between gap-3"><div><h1 className="flex items-center gap-2 text-3xl font-bold"><Sparkles className="text-blue-600"/>AI Trợ lý</h1><p className="mt-1 text-slate-500">Nhập Job từ tin nhắn và hỏi nhanh dữ liệu BEEN MEDIA.</p></div><div className={`rounded-xl px-3 py-2 text-sm font-semibold ${configured?"bg-emerald-50 text-emerald-700":"bg-amber-50 text-amber-700"}`}>{configured?`AI đã sẵn sàng${model?` • ${model}`:""}`:"Chưa có API key"}</div></div>
  {!configured&&<div className="mb-5 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900"><AlertTriangle className="mt-0.5 shrink-0"/><div><b>AI đã được tích hợp nhưng chưa có khóa API.</b><p className="text-sm">Thêm <code>OPENAI_API_KEY</code> vào file <code>.env.local</code>, sau đó khởi động lại app. Khóa chỉ nằm phía máy chủ, không hiển thị trên trình duyệt.</p></div></div>}
  <div className="mb-5 flex gap-2"><button onClick={()=>setTab("job")} className={`rounded-xl px-4 py-2 font-semibold ${tab==="job"?"bg-blue-600 text-white":"border bg-white"}`}><WandSparkles className="mr-2 inline" size={18}/>AI tạo Job</button><button onClick={()=>setTab("ask")} className={`rounded-xl px-4 py-2 font-semibold ${tab==="ask"?"bg-blue-600 text-white":"border bg-white"}`}><MessageCircleQuestion className="mr-2 inline" size={18}/>Hỏi AI</button></div>
  {tab==="job"?<div className="grid gap-5 lg:grid-cols-2"><section className="rounded-2xl bg-white p-5 shadow"><h2 className="text-lg font-bold">Dán tin nhắn khách</h2><p className="mb-3 text-sm text-slate-500">AI sẽ tự tách ngày, giờ, địa điểm, tiền cọc, số lượng thợ và thợ khách chỉ định.</p><textarea value={message} onChange={e=>setMessage(e.target.value)} className="min-h-64 w-full rounded-xl border p-4" placeholder={'Ví dụ: 29/8 ăn hỏi nhà gái Thường Tín, 6h30, 2 chụp 1 quay. Cô dâu yêu cầu Tuấn chụp đích danh. Tổng 10 triệu, cọc 3 triệu.'}/><button disabled={loading||!configured} onClick={parseJob} className="mt-3 flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-bold text-white disabled:opacity-50">{loading?<RefreshCw className="animate-spin" size={18}/>:<Sparkles size={18}/>}Phân tích bằng AI</button></section>
  <section className="rounded-2xl bg-white p-5 shadow"><h2 className="text-lg font-bold">Dữ liệu AI đọc được</h2>{!preview?<div className="grid min-h-64 place-items-center text-center text-slate-400"><div><Bot className="mx-auto mb-2" size={42}/><p>Chưa có dữ liệu. Dán tin nhắn và bấm “Phân tích bằng AI”.</p></div></div>:<div className="mt-3 space-y-3 text-sm"><div className="grid grid-cols-2 gap-3"><Info label="Khách" value={preview.customer_name}/><Info label="SĐT" value={preview.phone}/><Info label="Sự kiện" value={preview.event_name}/><Info label="Ngày chụp" value={formatDateVN(preview.shooting_date)}/><Info label="Giờ" value={[preview.start_time,preview.end_time].filter(Boolean).join(" - ")}/><Info label="Địa điểm" value={preview.address||preview.location_name}/><Info label="Tổng tiền" value={money(preview.total_price)}/><Info label="Đã cọc" value={money(preview.deposit)}/></div><div><b>Ekip AI nhận diện</b><div className="mt-2 flex flex-wrap gap-2">{(preview.assignments||[]).length?(preview.assignments||[]).map((a:any,i:number)=><span key={i} className={`rounded-full px-3 py-1 ${a.client_requested?"bg-red-50 text-red-700 ring-1 ring-red-200":"bg-slate-100"}`}>{a.role}{a.employee_name?` • ${a.employee_name}`:""}{a.client_requested?" • ⭐ chỉ định":""}</span>):<span className="text-slate-400">Chưa có</span>}</div></div>{requested.length>0&&<div className="rounded-xl bg-red-50 p-3 font-semibold text-red-700">⚠ Khách chỉ định: {requested.map((x:any)=>x.employee_name||x.role).join(", ")}</div>}<button onClick={openJobDraft} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white">Mở form Job để kiểm tra và lưu <ArrowRight size={18}/></button><p className="text-xs text-slate-500">AI chỉ điền trước. Bạn vẫn kiểm tra và bấm Lưu Job, AI không tự ý tạo dữ liệu.</p></div>}</section></div>
  :<section className="rounded-2xl bg-white p-5 shadow"><h2 className="text-lg font-bold">Hỏi dữ liệu bằng tiếng Việt</h2><p className="mb-3 text-sm text-slate-500">Ví dụ: “Ngày mai có mấy Job?”, “Ai chưa được trả lương?”, “Khách còn nợ bao nhiêu?”, “Tuấn có lịch ngày 29/8 không?”.</p><div className="flex flex-col gap-3 sm:flex-row"><input value={question} onChange={e=>setQuestion(e.target.value)} onKeyDown={e=>e.key==="Enter"&&ask()} className="flex-1 rounded-xl border p-3" placeholder="Nhập câu hỏi..."/><button disabled={loading||!configured} onClick={ask} className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white disabled:opacity-50">{loading?"Đang hỏi...":"Hỏi AI"}</button></div>{answer&&<div className="mt-5 whitespace-pre-wrap rounded-2xl bg-slate-50 p-5 leading-7 text-slate-800">{answer}</div>}</section>}
 </div></MainLayout>
}
function Info({label,value}:{label:string,value:any}){return <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-500">{label}</div><div className="mt-1 font-semibold text-slate-900">{value||"—"}</div></div>}
