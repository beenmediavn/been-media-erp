"use client";
import { useEffect,useMemo,useState } from "react";
import Link from "next/link";
import MainLayout from "./components/layout/MainLayout";
import { supabase } from "@/lib/supabase";
import { CalendarDays,Wallet,Users,CircleDollarSign,BellRing,AlertTriangle,ChevronRight,Plus,ReceiptText,UserRound,BarChart3 } from "lucide-react";
import { formatDateVN } from "@/lib/date-vn";

const money=(v:any)=>Number(v||0).toLocaleString("vi-VN")+" đ";
const localDate=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const addDays=(n:number)=>{const d=new Date();d.setDate(d.getDate()+n);return localDate(d)};
const statusDone=(s:any)=>String(s||"").toLowerCase().includes("hoàn thành")||String(s||"").toLowerCase().includes("đã bàn giao");

function Donut({done,doing,upcoming}:{done:number;doing:number;upcoming:number}){const total=Math.max(done+doing+upcoming,1);const a=done/total*100,b=doing/total*100;return <div className="relative mx-auto h-44 w-44 rounded-full" style={{background:`conic-gradient(#53b86c 0 ${a}%, #e8b438 ${a}% ${a+b}%, #35685a ${a+b}% 100%)`}}><div className="absolute inset-7 grid place-items-center rounded-full bg-white text-center shadow-inner"><div><b className="text-3xl">{done+doing+upcoming}</b><p className="text-xs bm-muted">Tổng job</p></div></div></div>}
function Bars({values}:{values:number[]}){const max=Math.max(...values,1);return <div className="flex h-44 items-end gap-2">{values.map((v,i)=><div key={i} className="flex flex-1 flex-col items-center gap-2"><div className="w-full rounded-t-lg bg-gradient-to-t from-blue-500 to-blue-300" style={{height:`${Math.max(v/max*130,5)}px`}}/><span className="text-[10px] bm-muted">T{i+1}</span></div>)}</div>}

export default function AdminDashboard(){
 const goArrangeStaff=(jobId:any)=>{
  if(!jobId||typeof window==="undefined") return;
  // Dùng full navigation + query để tránh RSC/PWA cache cũ làm mất job_id.
  const target=`/job?open=${encodeURIComponent(String(jobId))}&edit=1&focus=staff&v=835`;
  window.location.assign(target);
 };
 const [jobs,setJobs]=useState<any[]>([]),[jobDays,setJobDays]=useState<any[]>([]),[assignments,setAssignments]=useState<any[]>([]),[salaryPayments,setSalaryPayments]=useState<any[]>([]),[advances,setAdvances]=useState<any[]>([]),[transactions,setTransactions]=useState<any[]>([]),[loading,setLoading]=useState(true);
 async function load(){setLoading(true);const res=await Promise.all([supabase.from("jobs").select("*, customers(*)"),supabase.from("job_days").select("*, jobs(*, customers(*)), job_assignments(*, employees(*))").order("shooting_date",{ascending:true}),supabase.from("job_assignments").select("*, jobs(status)"),supabase.from("salary_payments").select("*"),supabase.from("salary_advances").select("*"),supabase.from("finance_transactions").select("*")]);setJobs(res[0].data||[]);setJobDays(res[1].data||[]);setAssignments(res[2].data||[]);setSalaryPayments(res[3].data||[]);setAdvances(res[4].data||[]);setTransactions(res[5].data||[]);setLoading(false)}
 useEffect(()=>{load()},[]);
 const today=localDate(),tomorrow=addDays(1),month=today.slice(0,7),year=Number(today.slice(0,4));
 const todayRows=jobDays.filter(x=>x.shooting_date===today),tomorrowRows=jobDays.filter(x=>x.shooting_date===tomorrow);
 const next24=[...todayRows,...tomorrowRows].filter(r=>r.shooting_date===tomorrow||String(r.end_time||"23:59")>=new Date().toTimeString().slice(0,5));
 const completedJobIds=new Set(jobs.filter(j=>statusDone(j.status)).map(j=>j.id));
 const debtJobs=jobs.filter(j=>completedJobIds.has(j.id)&&Number(j.debt||0)>0).sort((a,b)=>Number(b.debt||0)-Number(a.debt||0));
 const monthJobIds=new Set(jobDays.filter(r=>String(r.shooting_date||"").startsWith(month)).map(r=>r.job_id));
 const monthJobs=jobs.filter(j=>monthJobIds.has(j.id));
 const monthRevenue=monthJobs.reduce((s,j)=>s+Number(j.total_price||0),0);
 const debt=debtJobs.reduce((s,j)=>s+Math.max(Number(j.debt||0),0),0);
 const payableAssignments=assignments.filter((a:any)=>statusDone(a.jobs?.status));
 const salaryDue=Math.max(payableAssignments.reduce((s,a)=>s+Number(a.salary_amount||0),0)-salaryPayments.reduce((s,p)=>s+Number(p.amount||0),0)-advances.reduce((s,a)=>s+Number(a.amount||0),0),0);
 const monthExpense=transactions.filter(t=>t.transaction_type==="expense"&&String(t.transaction_date||"").startsWith(month)).reduce((s,t)=>s+Number(t.amount||0),0);
 const monthIncome=transactions.filter(t=>t.transaction_type==="income"&&String(t.transaction_date||"").startsWith(month)).reduce((s,t)=>s+Number(t.amount||0),0);
 const monthProfit=Math.max(monthRevenue-monthExpense-assignments.filter(a=>monthJobIds.has(a.job_id)).reduce((s,a)=>s+Number(a.salary_amount||0),0),0);
 const byMonth=Array.from({length:12},(_,i)=>{const pre=`${year}-${String(i+1).padStart(2,"0")}`;const ids=new Set(jobDays.filter(d=>String(d.shooting_date||"").startsWith(pre)).map(d=>d.job_id));return jobs.filter(j=>ids.has(j.id)).reduce((s,j)=>s+Number(j.total_price||0),0)});
 const done=monthJobs.filter(j=>statusDone(j.status)).length;const upcoming=monthJobs.filter(j=>!statusDone(j.status)&&jobDays.some((d:any)=>d.job_id===j.id&&d.shooting_date>today)).length;const doing=Math.max(monthJobs.length-done-upcoming,0);
 const nextJobs=jobDays.filter(d=>d.shooting_date>=today).slice(0,5);
 const recentTx=[...transactions].sort((a,b)=>String(b.transaction_date).localeCompare(String(a.transaction_date))).slice(0,5);
 const staffingWarnings=jobDays.filter((r:any)=>r.shooting_date>=today).map((r:any)=>{
   const reqPhoto=Number(r.jobs?.required_photo_count||0),reqVideo=Number(r.jobs?.required_video_count||0);
   const assignedPhoto=(r.job_assignments||[]).filter((a:any)=>String(a.role||"").toLowerCase().includes("chụp")).length;
   const assignedVideo=(r.job_assignments||[]).filter((a:any)=>String(a.role||"").toLowerCase().includes("quay")&&!String(a.role||"").toLowerCase().includes("fly")).length;
   const missingPhoto=Math.max(reqPhoto-assignedPhoto,0),missingVideo=Math.max(reqVideo-assignedVideo,0);
   return {...r,reqPhoto,reqVideo,assignedPhoto,assignedVideo,missingPhoto,missingVideo};
 }).filter((r:any)=>r.missingPhoto>0||r.missingVideo>0).sort((a:any,b:any)=>String(a.shooting_date).localeCompare(String(b.shooting_date)));
 const cards=[{label:"Job hôm nay",value:String(todayRows.length),sub:`Ngày mai: ${tomorrowRows.length} job`,icon:CalendarDays,href:"/schedule"},{label:"Khách còn nợ",value:money(debt),sub:`${debtJobs.length} job đã xong cần thu`,icon:Wallet,href:"/payments"},{label:"Cần trả thợ",value:money(salaryDue),sub:"Lương còn phải thanh toán",icon:Users,href:"/salary"},{label:"Doanh thu tháng",value:money(monthRevenue),sub:`Lợi nhuận dự kiến: ${money(monthProfit)}`,icon:CircleDollarSign,href:"/reports"}];
 return <MainLayout><div className="mx-auto max-w-7xl">
  <div className="mb-5 flex items-center justify-between gap-3"><div><h1 className="text-3xl font-black tracking-wide bm-gold">BEEN MEDIA</h1><p className="bm-muted">Hôm nay cần làm gì và tình hình đang ở đâu.</p></div><Link href="/schedule" className="hidden items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-bold text-white sm:flex"><Plus size={18}/>Tạo job</Link></div>
  {loading?<div className="bm-card rounded-3xl p-8 text-center bm-muted">Đang tải dữ liệu...</div>:<>
   <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{cards.map(c=>{const I=c.icon;return <Link href={c.href} key={c.label} className="bm-card rounded-3xl p-4 transition hover:-translate-y-0.5 sm:p-5"><span className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-blue-600 text-white"><I size={22}/></span><p className="text-xs bm-muted">{c.label}</p><p className={`mt-1 text-xl font-black ${c.label.includes("Cần trả")?"text-orange-700":c.label.includes("Doanh thu")?"text-emerald-700":c.label.includes("nợ")?"text-red-700":"text-slate-900"}`}>{c.value}</p><p className="mt-1 text-[11px] text-slate-600">{c.sub}</p></Link>})}</div>
   {staffingWarnings.length>0&&<section className="mt-4 rounded-3xl border-2 border-red-300 bg-red-50 p-4 sm:p-5"><div className="flex items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 text-lg font-black text-red-700"><AlertTriangle size={20}/> CẢNH BÁO JOB THIẾU THỢ ({staffingWarnings.length})</h2><p className="text-xs text-red-600">Cần sắp xếp thêm nhân sự trước ngày thực hiện.</p></div><button type="button" onClick={()=>goArrangeStaff(staffingWarnings[0]?.jobs?.id)} className="rounded-xl bg-red-600 px-3 py-2 text-sm font-bold text-white">Sắp xếp ngay</button></div><div className="mt-3 grid gap-2 md:grid-cols-2">{staffingWarnings.slice(0,8).map((r:any)=><button type="button" key={r.id} onClick={()=>goArrangeStaff(r.jobs?.id)} className="rounded-2xl bg-white p-3 text-left ring-1 ring-red-200 transition hover:ring-2 hover:ring-red-400"><div className="flex justify-between gap-2"><b>{r.jobs?.event_name||r.jobs?.customer_name||"Job"}</b><span className="text-xs font-semibold text-red-600">{formatDateVN(r.shooting_date)} • {r.start_time}</span></div><p className="mt-1 text-sm text-red-700">{r.missingPhoto>0?`Thiếu ${r.missingPhoto} thợ chụp`:""}{r.missingPhoto>0&&r.missingVideo>0?" • ":""}{r.missingVideo>0?`Thiếu ${r.missingVideo} thợ quay`:""}</p><p className="text-xs text-slate-500">Đã xếp: {r.assignedPhoto}/{r.reqPhoto} chụp • {r.assignedVideo}/{r.reqVideo} quay</p></button>)}</div></section>}
   <div className="mt-5 grid gap-4 lg:grid-cols-3">
    <section className="bm-card rounded-3xl p-5 lg:col-span-2"><div className="mb-3 flex items-center justify-between"><div><h2 className="text-lg font-bold">Doanh thu theo tháng</h2><p className="text-xs bm-muted">Năm {year}</p></div><BarChart3 className="bm-gold"/></div><Bars values={byMonth}/></section>
    <section className="bm-card rounded-3xl p-5"><h2 className="mb-3 text-lg font-bold">Trạng thái Job tháng này</h2><Donut done={done} doing={doing} upcoming={upcoming}/><div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs"><div><b className="text-[#53b86c]">{done}</b><p className="bm-muted">Đã xong</p></div><div><b className="bm-gold">{doing}</b><p className="bm-muted">Đang làm</p></div><div><b className="text-[#7ca898]">{upcoming}</b><p className="bm-muted">Sắp tới</p></div></div></section>
   </div>
   <div className="mt-4 grid gap-4 lg:grid-cols-2">
    <section className="bm-card rounded-3xl p-5"><div className="mb-3 flex justify-between"><div><h2 className="flex items-center gap-2 text-lg font-bold"><BellRing size={19} className="bm-gold"/>Job sắp tới</h2><p className="text-xs bm-muted">Chạm để xem chi tiết trên lịch</p></div><Link href="/schedule" className="bm-gold"><ChevronRight/></Link></div><div className="flex gap-3 overflow-x-auto pb-2">{nextJobs.map((r:any)=><Link href="/schedule" key={r.id} className="min-w-[230px] rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="truncate font-bold">{r.jobs?.event_name||r.jobs?.customer_name||"Job"}</p><p className="mt-1 text-xs bm-muted">{formatDateVN(r.shooting_date)} • {r.start_time||"--:--"}</p><p className="mt-4 font-bold bm-gold">{money(r.jobs?.total_price)}</p></Link>)}{nextJobs.length===0&&<p className="py-7 bm-muted">Chưa có job sắp tới.</p>}</div></section>
    <section className="bm-card rounded-3xl p-5"><div className="mb-3 flex justify-between"><div><h2 className="flex items-center gap-2 text-lg font-bold"><ReceiptText size={19} className="bm-gold"/>Gần đây</h2><p className="text-xs bm-muted">Các khoản thu / chi mới nhất</p></div><Link href="/cashflow" className="bm-gold"><ChevronRight/></Link></div><div className="space-y-2">{recentTx.map((t:any)=><div key={t.id} className="flex items-center justify-between border-b border-amber-300/10 py-2"><div><p className="font-semibold">{t.description||t.category||"Giao dịch"}</p><p className="text-xs bm-muted">{t.transaction_date} • {t.category||""}</p></div><b className={t.transaction_type==="expense"?"text-[#f0b84a]":"text-[#62c778]"}>{t.transaction_type==="expense"?"-":"+"}{money(t.amount)}</b></div>)}{recentTx.length===0&&<p className="py-7 bm-muted">Chưa có giao dịch.</p>}</div></section>
   </div>
   <div className="mt-4 grid gap-4 lg:grid-cols-2"><section className="bm-card rounded-3xl p-5"><h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><AlertTriangle size={19} className="bm-gold"/>Nhắc trong 24 giờ</h2><div className="space-y-2">{next24.slice(0,4).map((r:any)=><div key={r.id} className="rounded-2xl bg-slate-100 p-3"><b>{r.jobs?.event_name||r.jobs?.customer_name}</b><p className="text-xs bm-muted">{r.shooting_date===today?"Hôm nay":"Ngày mai"} • {r.start_time}-{r.end_time}</p></div>)}{!next24.length&&<p className="py-5 bm-muted">24 giờ tới chưa có job.</p>}</div></section><section className="bm-card rounded-3xl p-5"><h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><UserRound size={19} className="bm-gold"/>Dòng tiền tháng</h2><div className="grid grid-cols-3 gap-3 text-center"><div className="rounded-2xl bg-slate-100 p-3"><p className="text-xs bm-muted">Thu thêm</p><b className="text-[#62c778]">{money(monthIncome)}</b></div><div className="rounded-2xl bg-slate-100 p-3"><p className="text-xs bm-muted">Chi phí</p><b className="bm-gold">{money(monthExpense)}</b></div><div className="rounded-2xl bg-slate-100 p-3"><p className="text-xs bm-muted">Còn lại</p><b>{money(Math.max(monthIncome-monthExpense,0))}</b></div></div></section></div>
  </>}
 </div></MainLayout>
}
