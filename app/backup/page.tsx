"use client";

import { useEffect, useMemo, useState } from "react";
import MainLayout from "../components/layout/MainLayout";
import { supabase } from "@/lib/supabase";
import { downloadJson, downloadXlsx } from "@/lib/xlsx-export";
import { DatabaseBackup, Download, FileJson, RefreshCw, RotateCcw, Trash2 } from "lucide-react";

const pad = (n: number) => String(n).padStart(2, "0");
const today = new Date();
const defaultMonth = `${today.getFullYear()}-${pad(today.getMonth() + 1)}`;

const humanTable: Record<string, string> = { customers: "Khách hàng", employees: "Nhân sự", jobs: "Job" };

const tableSpecs = [
  { table: "customers", sheet: "Khach hang", mode: "all" },
  { table: "employees", sheet: "Nhan su", mode: "all", omit: ["password"] },
  { table: "jobs", sheet: "Jobs", mode: "jobs" },
  { table: "job_days", sheet: "Ngay chup", mode: "job_days" },
  { table: "job_locations", sheet: "Dia diem", mode: "job_related" },
  { table: "job_assignments", sheet: "Phan cong", mode: "job_related" },
  { table: "customer_payments", sheet: "Thu khach", mode: "job_related" },
  { table: "salary_advances", sheet: "Ung luong", mode: "month_date" },
  { table: "salary_payments", sheet: "Tra luong", mode: "month_date" },
  { table: "salary_adjustments", sheet: "Phat sinh luong", mode: "month_date" },
  { table: "finance_transactions", sheet: "Thu Chi", mode: "month_date" },
  { table: "google_drive_files", sheet: "San pham", mode: "job_related" },
  { table: "reserve_workers", sheet: "Tho du phong", mode: "month_date" },
  { table: "attendance_records", sheet: "Cham cong", mode: "job_related" },
] as const;

function stripFields(rows: any[], omit: readonly string[] = []) {
  return (rows || []).map((row) => {
    const out: Record<string, any> = {};
    Object.entries(row || {}).forEach(([k, v]) => { if (!omit.includes(k)) out[k] = v; });
    return out;
  });
}

function rowMatchesMonth(row: any, month: string) {
  const candidates = [row?.transaction_date, row?.payment_date, row?.advance_date, row?.adjustment_date, row?.reserve_date, row?.created_at, row?.check_in_at];
  return candidates.some((v) => String(v || "").startsWith(month));
}

export default function BackupPage() {
  const [month, setMonth] = useState(defaultMonth);
  const [scope, setScope] = useState<"month" | "all">("month");
  const [loading, setLoading] = useState(false);
  const [trashLoading, setTrashLoading] = useState(false);
  const [trash, setTrash] = useState<any[]>([]);
  const [trashReady, setTrashReady] = useState(true);

  const filenameBase = useMemo(() => `BEEN_MEDIA_BACKUP_${scope === "all" ? "TOAN_BO" : month}`, [month, scope]);

  async function fetchTable(table: string) {
    const { data, error } = await supabase.from(table).select("*");
    if (error) return { rows: [] as any[], error: error.message };
    return { rows: data || [], error: "" };
  }

  async function collectBackup() {
    setLoading(true);
    try {
      const raw: Record<string, any[]> = {};
      const errors: string[] = [];
      for (const spec of tableSpecs) {
        const res = await fetchTable(spec.table);
        raw[spec.table] = res.rows;
        if (res.error) errors.push(`${spec.table}: ${res.error}`);
      }

      let jobDays = raw.job_days || [];
      if (scope === "month") jobDays = jobDays.filter((r) => String(r.shooting_date || "").startsWith(month));
      const jobIds = new Set(jobDays.map((r) => String(r.job_id || "")).filter(Boolean));
      const dayIds = new Set(jobDays.map((r) => String(r.id || "")).filter(Boolean));

      let jobs = raw.jobs || [];
      if (scope === "month") jobs = jobs.filter((r) => jobIds.has(String(r.id)));
      if (scope === "all") jobs.forEach((r) => jobIds.add(String(r.id)));

      const selected: Record<string, any[]> = {};
      for (const spec of tableSpecs) {
        let rows = raw[spec.table] || [];
        if (spec.table === "jobs") rows = jobs;
        else if (spec.table === "job_days") rows = scope === "month" ? jobDays : rows;
        else if (scope === "month" && spec.mode === "job_related") {
          rows = rows.filter((r) => jobIds.has(String(r.job_id || "")) || dayIds.has(String(r.job_day_id || "")));
        } else if (scope === "month" && spec.mode === "month_date") {
          rows = rows.filter((r) => rowMatchesMonth(r, month));
        }
        selected[spec.table] = stripFields(rows, "omit" in spec ? spec.omit : []);
      }

      const meta = [{
        studio: "BEEN MEDIA",
        exported_at: new Date().toLocaleString("vi-VN"),
        scope: scope === "all" ? "Toàn bộ dữ liệu" : `Theo tháng ${month}`,
        customers: selected.customers?.length || 0,
        employees: selected.employees?.length || 0,
        jobs: selected.jobs?.length || 0,
        note: "File Excel/JSON này độc lập với app. Dữ liệu đã tải về máy không tự mất khi xóa trên ERP.",
        warning: errors.length ? errors.join(" | ") : "",
      }];

      return { selected, meta, errors };
    } finally {
      setLoading(false);
    }
  }

  function buildSimpleExcel(selected: Record<string, any[]>) {
    const jobs = selected.jobs || [];
    const days = selected.job_days || [];
    const assignments = selected.job_assignments || [];
    const employees = selected.employees || [];
    const payments = selected.customer_payments || [];
    const tx = selected.finance_transactions || [];

    const employeeName = new Map(employees.map((e:any)=>[String(e.id), e.full_name || e.name || "Nhân sự"]));
    const daysByJob = new Map<string, any[]>();
    for (const d of days) {
      const key=String(d.job_id||"");
      if(!daysByJob.has(key)) daysByJob.set(key,[]);
      daysByJob.get(key)!.push(d);
    }
    const assignmentsByJob = new Map<string, any[]>();
    for (const a of assignments) {
      let jobId=String(a.job_id||"");
      if(!jobId && a.job_day_id){
        const d=days.find((x:any)=>String(x.id)===String(a.job_day_id));
        jobId=String(d?.job_id||"");
      }
      if(!jobId) continue;
      if(!assignmentsByJob.has(jobId)) assignmentsByJob.set(jobId,[]);
      assignmentsByJob.get(jobId)!.push(a);
    }

    const jobRows = jobs.map((job:any)=>{
      const jobId=String(job.id||"");
      const jobDays=(daysByJob.get(jobId)||[]).slice().sort((a:any,b:any)=>String(a.shooting_date||"").localeCompare(String(b.shooting_date||"")));
      const ass=assignmentsByJob.get(jobId)||[];
      const namesFor=(kind:string)=>Array.from(new Set(ass.filter((a:any)=>{
        const r=String(a.role||"").toLowerCase();
        return kind==="photo" ? r.includes("chụp") : (r.includes("quay") && !r.includes("fly"));
      }).map((a:any)=>String(employeeName.get(String(a.employee_id))||"Nhân sự")))).join(", ");
      const total=Number(job.total_price||0);
      const paid=Number(job.deposit||0);
      const debt=Math.max(Number(job.debt ?? (total-paid)),0);
      const salary=ass.reduce((sum:number,a:any)=>sum+Number(a.salary_amount||0),0);
      return {
        "Ngày Job": Array.from(new Set(jobDays.map((d:any)=>String(d.shooting_date||"")).filter(Boolean))).join(" / "),
        "Khách / Job": job.event_name || job.customer_name || "Job",
        "Tổng tiền": total,
        "Đã cọc / đã thu": paid,
        "Còn nợ": debt,
        "Thợ chụp": namesFor("photo"),
        "Thợ quay": namesFor("video"),
        "Lương ekip": salary,
        "Lãi dự kiến Job": total-salary,
      };
    });

    const incoming = payments.reduce((sum:number,p:any)=>sum+Number(p.amount||0),0);
    const outgoing = tx.filter((x:any)=>String(x.transaction_type||"").toLowerCase()==="expense").reduce((sum:number,x:any)=>sum+Number(x.amount||0),0);
    const totalJobValue = jobs.reduce((sum:number,j:any)=>sum+Number(j.total_price||0),0);
    const totalDeposits = jobs.reduce((sum:number,j:any)=>sum+Number(j.deposit||0),0);
    const totalDebt = jobs.reduce((sum:number,j:any)=>sum+Math.max(Number(j.debt ?? (Number(j.total_price||0)-Number(j.deposit||0))),0),0);
    const totalSalary = assignments.reduce((sum:number,a:any)=>sum+Number(a.salary_amount||0),0);
    const summary=[{
      "Kỳ sao lưu": scope === "all" ? "Toàn bộ" : month,
      "Số Job": jobs.length,
      "Tổng giá trị Job": totalJobValue,
      "Tổng đã cọc / đã thu của Job": totalDeposits,
      "Tổng còn nợ": totalDebt,
      "Tiền vào trong kỳ": incoming,
      "Tiền ra trong kỳ": outgoing,
      "Tổng lương thợ theo Job": totalSalary,
      "Còn lãi (Tiền vào - Tiền ra)": incoming-outgoing,
    }];

    const salaryMap=new Map<string,{name:string,photo:number,video:number,other:number,jobs:Set<string>,salary:number}>();
    for(const a of assignments){
      const id=String(a.employee_id||"unknown");
      if(!salaryMap.has(id)) salaryMap.set(id,{name:String(employeeName.get(id)||"Nhân sự"),photo:0,video:0,other:0,jobs:new Set(),salary:0});
      const row=salaryMap.get(id)!;
      const role=String(a.role||"").toLowerCase();
      if(role.includes("chụp")) row.photo++; else if(role.includes("quay")&&!role.includes("fly")) row.video++; else row.other++;
      if(a.job_id) row.jobs.add(String(a.job_id));
      row.salary+=Number(a.salary_amount||0);
    }
    const salaryRows=Array.from(salaryMap.values()).map(x=>({
      "Nhân sự":x.name,
      "Số Job":x.jobs.size,
      "Lượt chụp":x.photo,
      "Lượt quay":x.video,
      "Việc khác":x.other,
      "Tổng lương":x.salary,
    })).sort((a,b)=>Number(b["Tổng lương"])-Number(a["Tổng lương"]));

    return [
      { name: "TONG HOP", rows: summary },
      { name: "CHI TIET JOB", rows: jobRows },
      { name: "LUONG THO", rows: salaryRows },
    ];
  }

  async function exportExcel() {
    const result = await collectBackup();
    downloadXlsx(`${filenameBase}.xlsx`, buildSimpleExcel(result.selected));
    if (result.errors.length) alert("Đã xuất Excel gọn. Một số bảng chưa có hoặc chưa được cài nên được bỏ qua:\n" + result.errors.join("\n"));
  }

  async function exportJson() {
    const result = await collectBackup();
    downloadJson(`${filenameBase}.json`, {
      version: "8.3.9",
      exported_at: new Date().toISOString(),
      scope,
      month: scope === "month" ? month : null,
      data: result.selected,
      errors: result.errors,
    });
  }

  async function loadTrash() {
    setTrashLoading(true);
    const { data, error } = await supabase.rpc("been_list_trash");
    setTrashLoading(false);
    if (error) {
      setTrashReady(false);
      setTrash([]);
      return;
    }
    setTrashReady(true);
    setTrash(data || []);
  }

  useEffect(() => { loadTrash(); }, []);

  async function restore(item: any) {
    if (!confirm(`Khôi phục ${humanTable[item.entity_type] || item.entity_type}: ${item.name || item.id}?`)) return;
    const { error } = await supabase.rpc("been_restore_trash", { p_entity_type: item.entity_type, p_id: item.id });
    if (error) return alert(error.message);
    await loadTrash();
    alert("Đã khôi phục dữ liệu.");
  }

  return (
    <MainLayout>
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold">SAO LƯU DỮ LIỆU</h1>
          <p className="mt-1 text-slate-500">Tải dữ liệu về máy tính để vẫn xem được kể cả khi sau này dữ liệu trên app bị xóa.</p>
        </div>

        <section className="rounded-3xl bg-white p-5 shadow sm:p-6">
          <div className="mb-5 flex items-center gap-3"><DatabaseBackup className="text-blue-600"/><div><h2 className="text-xl font-bold">Xuất bản sao lưu</h2><p className="text-sm text-slate-500">Excel chỉ giữ các số liệu chính để quản lý nhanh: tổng tháng, chi tiết Job và lương thợ. JSON vẫn giữ đầy đủ dữ liệu kỹ thuật để phục hồi khi cần.</p></div></div>
          <div className="grid gap-3 md:grid-cols-4">
            <select value={scope} onChange={(e)=>setScope(e.target.value as any)} className="rounded-xl border px-4 py-3">
              <option value="month">Theo tháng</option>
              <option value="all">Toàn bộ dữ liệu</option>
            </select>
            <input type="month" value={month} disabled={scope === "all"} onChange={(e)=>setMonth(e.target.value)} className="rounded-xl border px-4 py-3 disabled:bg-slate-100"/>
            <button onClick={exportExcel} disabled={loading} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white disabled:opacity-50"><Download size={18}/>{loading ? "Đang tạo..." : "Tải Excel về máy"}</button>
            <button onClick={exportJson} disabled={loading} className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 font-bold text-white disabled:opacity-50"><FileJson size={18}/>Tải JSON phục hồi</button>
          </div>
          <div className="mt-4 rounded-2xl bg-blue-50 p-4 text-sm text-blue-900">
            <b>Excel đã được rút gọn.</b> Chỉ còn các số chính: tiền vào, tiền ra, số Job, tổng tiền/cọc/còn nợ, ai chụp/quay, lương ekip và lãi. File JSON vẫn là bản sao lưu đầy đủ để phục hồi dữ liệu khi cần.
          </div>
        </section>

        <section className="rounded-3xl bg-white p-5 shadow sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3"><Trash2 className="text-red-600"/><div><h2 className="text-xl font-bold">THÙNG RÁC 30 NGÀY</h2><p className="text-sm text-slate-500">Khách hàng, nhân sự và Job bị xóa sẽ chuyển vào đây thay vì mất ngay.</p></div></div>
            <button onClick={loadTrash} className="flex items-center gap-2 rounded-xl border px-4 py-2"><RefreshCw size={16}/>Làm mới</button>
          </div>
          {!trashReady && <div className="rounded-xl bg-amber-50 p-4 text-amber-800">Chưa cài chức năng Thùng rác trong Supabase. Chạy file <b>UPDATE_V8_3_9_BACKUP_TRASH.sql</b> một lần.</div>}
          {trashReady && <div className="overflow-x-auto"><table className="w-full min-w-[760px]"><thead><tr className="border-b bg-slate-50"><th className="p-3 text-left">Loại</th><th className="p-3 text-left">Tên</th><th className="p-3 text-left">Ngày xóa</th><th className="p-3 text-left">Người xóa</th><th className="p-3 text-left">Còn lại</th><th className="p-3 text-left">Thao tác</th></tr></thead><tbody>{trashLoading?<tr><td className="p-4" colSpan={6}>Đang tải...</td></tr>:trash.length===0?<tr><td className="p-6 text-center text-slate-500" colSpan={6}>Thùng rác đang trống.</td></tr>:trash.map((item:any)=>{const del=new Date(item.deleted_at);const days=Math.max(0,30-Math.floor((Date.now()-del.getTime())/86400000));return <tr key={`${item.entity_type}-${item.id}`} className="border-b"><td className="p-3">{humanTable[item.entity_type]||item.entity_type}</td><td className="p-3 font-semibold">{item.name||item.id}</td><td className="p-3">{del.toLocaleString("vi-VN")}</td><td className="p-3">{item.deleted_by||"Admin"}</td><td className="p-3">{days} ngày</td><td className="p-3"><button onClick={()=>restore(item)} className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-white"><RotateCcw size={16}/>Khôi phục</button></td></tr>})}</tbody></table></div>}
        </section>
      </div>
    </MainLayout>
  );
}
