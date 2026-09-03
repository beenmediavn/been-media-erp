"use client";
import { useEffect,useMemo,useState } from "react";
import MainLayout from "../components/layout/MainLayout";
import { supabase } from "@/lib/supabase";
import type { AppUser } from "@/lib/auth";
import { formatDateVN } from "@/lib/date-vn";

const money=(v:any)=>Number(v||0).toLocaleString("vi-VN")+" đ";

export default function WorkerSalaryPage({user}:{user:AppUser}){
  const [assignments,setAssignments]=useState<any[]>([]);
  const [advances,setAdvances]=useState<any[]>([]);
  const [payments,setPayments]=useState<any[]>([]);
  const [adjustments,setAdjustments]=useState<any[]>([]);
  const [month,setMonth]=useState(new Date().toISOString().slice(0,7));

  async function load(){
    const [a,v,p,adj]=await Promise.all([
      supabase.from("job_assignments").select("*,jobs(event_name,customer_name),job_days(shooting_date,start_time,end_time)").eq("employee_id",user.id),
      supabase.from("salary_advances").select("*").eq("employee_id",user.id),
      supabase.from("salary_payments").select("*").eq("employee_id",user.id),
      supabase.from("salary_adjustments").select("*,jobs(event_name,customer_name)").eq("employee_id",user.id).order("adjustment_date",{ascending:false})
    ]);
    setAssignments(a.data||[]);setAdvances(v.data||[]);setPayments(p.data||[]);setAdjustments(adj.data||[]);
  }
  useEffect(()=>{load()},[user.id]);

  const ass=useMemo(()=>assignments.filter(a=>a.job_days?.shooting_date?.startsWith(month)),[assignments,month]);
  const adv=advances.filter(a=>a.advance_date?.startsWith(month));
  const pay=payments.filter(a=>a.payment_date?.startsWith(month));
  const adj=adjustments.filter(a=>a.adjustment_date?.startsWith(month));
  const base=ass.reduce((s,a)=>s+Number(a.salary_amount||0),0);
  const adjustmentTotal=adj.reduce((s,a)=>s+Number(a.amount||0),0);
  const total=base+adjustmentTotal;
  const advanced=adv.reduce((s,a)=>s+Number(a.amount||0),0);
  const paid=pay.reduce((s,a)=>s+Number(a.amount||0),0);
  const remain=Math.max(total-advanced-paid,0);

  return <MainLayout><div className="mx-auto max-w-5xl">
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-bold sm:text-3xl">Lương của tôi</h1><p className="text-slate-500">Chỉ hiển thị lương của tài khoản {user.full_name}.</p></div><input type="month" value={month} onChange={e=>setMonth(e.target.value)} className="rounded-xl border bg-white p-3"/></div>

    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      <div className="rounded-2xl bg-white p-4 shadow"><p className="text-sm text-slate-500">Lương Job</p><b className="text-xl">{money(base)}</b></div>
      <div className="rounded-2xl bg-white p-4 shadow"><p className="text-sm text-slate-500">Phát sinh +/-</p><b className={`text-xl ${adjustmentTotal<0?"text-red-600":"text-emerald-700"}`}>{adjustmentTotal>=0?"+":""}{money(adjustmentTotal)}</b></div>
      <div className="rounded-2xl bg-white p-4 shadow"><p className="text-sm text-slate-500">Đã ứng</p><b className="text-xl text-orange-600">{money(advanced)}</b></div>
      <div className="rounded-2xl bg-white p-4 shadow"><p className="text-sm text-slate-500">Đã thanh toán</p><b className="text-xl text-emerald-700">{money(paid)}</b></div>
      <div className="col-span-2 rounded-2xl bg-white p-4 shadow sm:col-span-1"><p className="text-sm text-slate-500">Còn phải nhận</p><b className="text-xl text-red-600">{money(remain)}</b></div>
    </div>

    <div className="mt-5 rounded-2xl bg-white p-4 shadow"><h2 className="mb-3 text-lg font-bold">Phát sinh / khấu trừ</h2><div className="space-y-2">{adj.map(x=><div key={x.id} className="rounded-xl bg-slate-50 p-3 text-sm"><div className="flex justify-between gap-3"><b className={Number(x.amount)<0?"text-red-600":"text-emerald-700"}>{Number(x.amount)<0?"Trừ ":"Cộng "}{money(Math.abs(Number(x.amount||0)))}</b><span>{formatDateVN(x.adjustment_date)}</span></div><p>{x.adjustment_type==="penalty"?"Vi phạm / khấu trừ":x.adjustment_type==="tip"?"Tip khách":x.adjustment_type==="bonus"?"Thưởng":"Khác"}{x.jobs?.event_name?` • ${x.jobs.event_name}`:""}</p><p className="text-slate-500">{x.note}</p></div>)}{!adj.length&&<p className="text-sm text-slate-500">Tháng này chưa có phát sinh.</p>}</div></div>

    <div className="mt-5 rounded-2xl bg-white p-4 shadow"><h2 className="mb-3 text-lg font-bold">Các Job tính lương trong tháng</h2><div className="overflow-x-auto"><table className="w-full min-w-[650px] text-sm"><thead><tr className="border-b"><th className="p-2 text-left">Ngày</th><th className="p-2 text-left">Job</th><th className="p-2 text-left">Nhiệm vụ</th><th className="p-2 text-right">Tiền công</th></tr></thead><tbody>{ass.map(a=><tr key={a.id} className="border-b"><td className="p-2">{formatDateVN(a.job_days?.shooting_date)}<br/><span className="text-slate-500">{a.job_days?.start_time}-{a.job_days?.end_time}</span></td><td className="p-2">{a.jobs?.event_name||a.jobs?.customer_name}</td><td className="p-2">{a.role}</td><td className="p-2 text-right font-bold">{money(a.salary_amount)}</td></tr>)}</tbody></table></div></div>
  </div></MainLayout>
}
