"use client";
import { useEffect,useState } from "react";
import MainLayout from "../components/layout/MainLayout";
import { supabase } from "@/lib/supabase";
import { formatDateTimeVN } from "@/lib/date-vn";

const LABELS:Record<string,string>={jobs:"Job",customers:"Khách hàng",job_assignments:"Phân công",salary_adjustments:"Lương phát sinh",google_drive_files:"Sản phẩm"};
export default function AuditPage(){
 const [rows,setRows]=useState<any[]>([]),[loading,setLoading]=useState(true),[filter,setFilter]=useState("");
 async function load(){setLoading(true);const {data,error}=await supabase.from("audit_logs").select("*").order("created_at",{ascending:false}).limit(500);setLoading(false);if(error)return alert(error.message);setRows(data||[])}
 useEffect(()=>{load()},[]);
 const visible=filter?rows.filter(r=>r.entity_type===filter):rows;
 return <MainLayout><div className="mx-auto max-w-7xl"><div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-bold sm:text-3xl">NHẬT KÝ HỆ THỐNG</h1><p className="text-sm text-slate-500">Theo dõi các thay đổi dữ liệu quan trọng gần nhất.</p></div><select value={filter} onChange={e=>setFilter(e.target.value)} className="rounded-xl border bg-white p-3"><option value="">Tất cả</option>{Object.entries(LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div><div className="overflow-hidden rounded-3xl bg-white shadow"><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="bg-slate-50"><tr><th className="p-3 text-left">Thời gian</th><th className="p-3 text-left">Mục</th><th className="p-3 text-left">Thao tác</th><th className="p-3 text-left">ID</th><th className="p-3 text-left">Ghi chú</th></tr></thead><tbody>{visible.map(r=><tr key={r.id} className="border-t"><td className="p-3">{formatDateTimeVN(r.created_at)}</td><td className="p-3 font-semibold">{LABELS[r.entity_type]||r.entity_type}</td><td className="p-3"><span className="rounded-full bg-slate-100 px-2 py-1 font-semibold">{r.action}</span></td><td className="max-w-[220px] truncate p-3 text-xs text-slate-500">{r.entity_id}</td><td className="p-3 text-slate-500">{r.note||""}</td></tr>)}{!loading&&!visible.length&&<tr><td colSpan={5} className="p-8 text-center text-slate-500">Chưa có nhật ký.</td></tr>}</tbody></table></div>{loading&&<p className="p-6 text-center text-slate-500">Đang tải...</p>}</div></div></MainLayout>
}
