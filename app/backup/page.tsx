"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import MainLayout from "../components/layout/MainLayout";
import { supabase } from "@/lib/supabase";
import { downloadJson, downloadXlsx } from "@/lib/xlsx-export";
import {
  DatabaseBackup,
  Download,
  FileJson,
  RefreshCw,
  RotateCcw,
  Trash2,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Layers,
  FileText
} from "lucide-react";

const pad = (n: number) => String(n).padStart(2, "0");
const today = new Date();
const defaultMonth = `${today.getFullYear()}-${pad(today.getMonth() + 1)}`;

const humanTable: Record<string, string> = {
  customers: "Khách hàng",
  employees: "Nhân sự",
  jobs: "Job",
  job_days: "Ngày chụp",
  job_locations: "Địa điểm chụp",
  job_assignments: "Phân công thợ",
  customer_payments: "Thu khách",
  salary_advances: "Ứng lương",
  salary_payments: "Trả lương",
  salary_adjustments: "Phát sinh lương",
  finance_transactions: "Thu / Chi",
  google_drive_files: "File sản phẩm",
  reserve_workers: "Thợ dự phòng",
  attendance_records: "Chấm công",
};

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
    Object.entries(row || {}).forEach(([k, v]) => {
      if (!omit.includes(k)) out[k] = v;
    });
    return out;
  });
}

function rowMatchesMonth(row: any, month: string) {
  const candidates = [
    row?.transaction_date,
    row?.payment_date,
    row?.advance_date,
    row?.adjustment_date,
    row?.reserve_date,
    row?.created_at,
    row?.check_in_at
  ];
  return candidates.some((v) => String(v || "").startsWith(month));
}

export default function BackupPage() {
  const [month, setMonth] = useState(defaultMonth);
  const [scope, setScope] = useState<"month" | "all">("month");
  const [loading, setLoading] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loadingCounts, setLoadingCounts] = useState(true);

  // Khôi phục từ JSON
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [restoreData, setRestoreData] = useState<any | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState("");

  // Thùng rác
  const [trashLoading, setTrashLoading] = useState(false);
  const [trash, setTrash] = useState<any[]>([]);
  const [trashReady, setTrashReady] = useState(true);

  const filenameBase = useMemo(
    () => `BEEN_MEDIA_BACKUP_${scope === "all" ? "TOAN_BO" : month}`,
    [month, scope]
  );

  async function loadTableCounts() {
    setLoadingCounts(true);
    const newCounts: Record<string, number> = {};
    for (const spec of tableSpecs) {
      try {
        const { count, error } = await supabase
          .from(spec.table)
          .select("*", { count: "exact", head: true });
        if (!error && count !== null) {
          newCounts[spec.table] = count;
        } else {
          newCounts[spec.table] = 0;
        }
      } catch {
        newCounts[spec.table] = 0;
      }
    }
    setCounts(newCounts);
    setLoadingCounts(false);
  }

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
      if (scope === "month")
        jobDays = jobDays.filter((r) => String(r.shooting_date || "").startsWith(month));
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
          rows = rows.filter(
            (r) => jobIds.has(String(r.job_id || "")) || dayIds.has(String(r.job_day_id || ""))
          );
        } else if (scope === "month" && spec.mode === "month_date") {
          rows = rows.filter((r) => rowMatchesMonth(r, month));
        }
        selected[spec.table] = stripFields(rows, "omit" in spec ? spec.omit : []);
      }

      const meta = [
        {
          studio: "BEEN MEDIA",
          exported_at: new Date().toLocaleString("vi-VN"),
          scope: scope === "all" ? "Toàn bộ dữ liệu" : `Theo tháng ${month}`,
          customers: selected.customers?.length || 0,
          employees: selected.employees?.length || 0,
          jobs: selected.jobs?.length || 0,
          note: "File độc lập với app. Dữ liệu đã tải về máy không tự mất khi xóa trên ERP.",
          warning: errors.length ? errors.join(" | ") : "",
        },
      ];

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

    const employeeName = new Map(
      employees.map((e: any) => [String(e.id), e.full_name || e.name || "Nhân sự"])
    );
    const daysByJob = new Map<string, any[]>();
    for (const d of days) {
      const key = String(d.job_id || "");
      if (!daysByJob.has(key)) daysByJob.set(key, []);
      daysByJob.get(key)!.push(d);
    }
    const assignmentsByJob = new Map<string, any[]>();
    for (const a of assignments) {
      let jobId = String(a.job_id || "");
      if (!jobId && a.job_day_id) {
        const d = days.find((x: any) => String(x.id) === String(a.job_day_id));
        jobId = String(d?.job_id || "");
      }
      if (!jobId) continue;
      if (!assignmentsByJob.has(jobId)) assignmentsByJob.set(jobId, []);
      assignmentsByJob.get(jobId)!.push(a);
    }

    const jobRows = jobs.map((job: any) => {
      const jobId = String(job.id || "");
      const jobDays = (daysByJob.get(jobId) || [])
        .slice()
        .sort((a: any, b: any) =>
          String(a.shooting_date || "").localeCompare(String(b.shooting_date || ""))
        );
      const ass = assignmentsByJob.get(jobId) || [];
      const namesFor = (kind: string) =>
        Array.from(
          new Set(
            ass
              .filter((a: any) => {
                const r = String(a.role || "").toLowerCase();
                return kind === "photo" ? r.includes("chụp") : r.includes("quay") && !r.includes("fly");
              })
              .map((a: any) => String(employeeName.get(String(a.employee_id)) || "Nhân sự"))
          )
        ).join(", ");
      const total = Number(job.total_price || 0);
      const paid = Number(job.deposit || 0);
      const debt = Math.max(Number(job.debt ?? total - paid), 0);
      const salary = ass.reduce((sum: number, a: any) => sum + Number(a.salary_amount || 0), 0);
      return {
        "Ngày Job": Array.from(new Set(jobDays.map((d: any) => String(d.shooting_date || "")).filter(Boolean))).join(" / "),
        "Khách / Job": job.event_name || job.customer_name || "Job",
        "Tổng tiền": total,
        "Đã cọc / đã thu": paid,
        "Còn nợ": debt,
        "Thợ chụp": namesFor("photo"),
        "Thợ quay": namesFor("video"),
        "Lương ekip": salary,
        "Lãi dự kiến Job": total - salary,
      };
    });

    const incoming = payments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
    const outgoing = tx
      .filter((x: any) => String(x.transaction_type || "").toLowerCase() === "expense")
      .reduce((sum: number, x: any) => sum + Number(x.amount || 0), 0);
    const totalJobValue = jobs.reduce((sum: number, j: any) => sum + Number(j.total_price || 0), 0);
    const totalDeposits = jobs.reduce((sum: number, j: any) => sum + Number(j.deposit || 0), 0);
    const totalDebt = jobs.reduce(
      (sum: number, j: any) =>
        sum + Math.max(Number(j.debt ?? Number(j.total_price || 0) - Number(j.deposit || 0)), 0),
      0
    );
    const totalSalary = assignments.reduce((sum: number, a: any) => sum + Number(a.salary_amount || 0), 0);
    const summary = [
      {
        "Kỳ sao lưu": scope === "all" ? "Toàn bộ" : month,
        "Số Job": jobs.length,
        "Tổng giá trị Job": totalJobValue,
        "Tổng đã cọc / đã thu": totalDeposits,
        "Tổng còn nợ": totalDebt,
        "Tiền vào": incoming,
        "Tiền ra": outgoing,
        "Tổng lương thợ theo Job": totalSalary,
        "Còn lãi": incoming - outgoing,
      },
    ];

    const salaryMap = new Map<string, any>();
    for (const a of assignments) {
      const id = String(a.employee_id || "unknown");
      if (!salaryMap.has(id)) {
        salaryMap.set(id, {
          name: String(employeeName.get(id) || "Nhân sự"),
          photo: 0,
          video: 0,
          other: 0,
          jobs: new Set(),
          salary: 0,
        });
      }
      const row = salaryMap.get(id)!;
      const role = String(a.role || "").toLowerCase();
      if (role.includes("chụp")) row.photo++;
      else if (role.includes("quay") && !role.includes("fly")) row.video++;
      else row.other++;
      if (a.job_id) row.jobs.add(String(a.job_id));
      row.salary += Number(a.salary_amount || 0);
    }
    const salaryRows = Array.from(salaryMap.values())
      .map((x) => ({
        "Nhân sự": x.name,
        "Số Job": x.jobs.size,
        "Lượt chụp": x.photo,
        "Lượt quay": x.video,
        "Việc khác": x.other,
        "Tổng lương": x.salary,
      }))
      .sort((a, b) => Number(b["Tổng lương"]) - Number(a["Tổng lương"]));

    return [
      { name: "TONG HOP", rows: summary },
      { name: "CHI TIET JOB", rows: jobRows },
      { name: "LUONG THO", rows: salaryRows },
    ];
  }

  async function exportExcel() {
    const result = await collectBackup();
    downloadXlsx(`${filenameBase}.xlsx`, buildSimpleExcel(result.selected));
    if (result.errors.length)
      alert("Đã xuất Excel gọn. Một số bảng chưa có được bỏ qua:\n" + result.errors.join("\n"));
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

  // Đọc file JSON để chuẩn bị Restore
  function handleSelectJsonFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (!json.data) {
          alert("File JSON không hợp lệ hoặc không có dữ liệu sao lưu.");
          return;
        }
        setRestoreData(json);
      } catch (err: any) {
        alert("Lỗi đọc file JSON: " + err.message);
      }
    };
    reader.readAsText(file);
  }

  // Thực hiện Restore vào Supabase
  async function executeRestore() {
    if (!restoreData?.data) return;
    if (
      !confirm(
        "CẢNH BÁO: Quá trình khôi phục sẽ ghi đè/bổ sung dữ liệu từ file backup vào hệ thống. Bạn có chắc chắn muốn thực hiện?"
      )
    )
      return;

    setRestoring(true);
    try {
      const data = restoreData.data;
      for (const [table, rows] of Object.entries(data)) {
        if (!Array.isArray(rows) || rows.length === 0) continue;
        setRestoreProgress(`Đang khôi phục bảng ${humanTable[table] || table} (${rows.length} mục)...`);
        const { error } = await supabase.from(table).upsert(rows, { onConflict: "id" });
        if (error) {
          console.error(`Lỗi khôi phục ${table}:`, error.message);
        }
      }
      alert("Khôi phục dữ liệu từ bản sao lưu hoàn tất thành công!");
      setRestoreData(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      loadTableCounts();
    } catch (err: any) {
      alert("Lỗi khôi phục: " + err.message);
    } finally {
      setRestoring(false);
      setRestoreProgress("");
    }
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

  useEffect(() => {
    loadTableCounts();
    loadTrash();
  }, []);

  async function restore(item: any) {
    if (!confirm(`Khôi phục ${humanTable[item.entity_type] || item.entity_type}: ${item.name || item.id}?`))
      return;
    const { error } = await supabase.rpc("been_restore_trash", {
      p_entity_type: item.entity_type,
      p_id: item.id,
    });
    if (error) return alert(error.message);
    await loadTrash();
    await loadTableCounts();
    alert("Đã khôi phục dữ liệu.");
  }

  return (
    <MainLayout>
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl text-slate-800">SAO LƯU & PHỤC HỒI DỮ LIỆU</h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Tải dữ liệu an toàn về máy tính hoặc khôi phục lại khi cần thiết. Độc lập hoàn toàn với máy chủ.
          </p>
        </div>

        {/* Thống kê dữ liệu hiện tại */}
        <section className="rounded-3xl bg-white p-5 shadow-sm border sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="text-blue-600" size={20} />
              <h2 className="text-base sm:text-lg font-bold text-slate-800">
                Thống kê dữ liệu thực tế trên hệ thống
              </h2>
            </div>
            <button
              onClick={loadTableCounts}
              disabled={loadingCounts}
              className="flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold hover:bg-slate-50"
            >
              <RefreshCw size={14} className={loadingCounts ? "animate-spin" : ""} />
              Cập nhật số liệu
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {tableSpecs.map((spec) => (
              <div key={spec.table} className="rounded-2xl border bg-slate-50/50 p-3 text-center">
                <span className="block text-xs text-slate-500 truncate" title={humanTable[spec.table] || spec.table}>
                  {humanTable[spec.table] || spec.table}
                </span>
                <span className="mt-1 block text-lg font-extrabold text-slate-800">
                  {loadingCounts ? "..." : counts[spec.table] ?? 0}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Khối Xuất dữ liệu */}
        <section className="rounded-3xl bg-white p-5 shadow-sm border sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <DatabaseBackup className="text-blue-600" size={26} />
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-800">1. Xuất bản sao lưu về máy tính</h2>
              <p className="text-xs sm:text-sm text-slate-500">
                Excel chứa các bảng tổng hợp và báo cáo nhanh. JSON là bản sao lưu kỹ thuật đầy đủ để phục hồi.
              </p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as any)}
              className="rounded-xl border px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-blue-500"
            >
              <option value="month">Theo tháng</option>
              <option value="all">Toàn bộ dữ liệu hệ thống</option>
            </select>
            <input
              type="month"
              value={month}
              disabled={scope === "all"}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-xl border px-4 py-3 text-sm disabled:bg-slate-100 focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={exportExcel}
              disabled={loading}
              className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-all"
            >
              <Download size={18} />
              {loading ? "Đang xử lý..." : "Tải Excel báo cáo"}
            </button>
            <button
              onClick={exportJson}
              disabled={loading}
              className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-black disabled:opacity-50 transition-all"
            >
              <FileJson size={18} />
              Tải JSON sao lưu
            </button>
          </div>
        </section>

        {/* Khối Phục hồi dữ liệu từ file JSON */}
        <section className="rounded-3xl bg-white p-5 shadow-sm border sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <UploadCloud className="text-indigo-600" size={26} />
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-800">2. Phục hồi dữ liệu từ file sao lưu (JSON)</h2>
              <p className="text-xs sm:text-sm text-slate-500">
                Tải lên tệp JSON đã backup trước đây để khôi phục hoặc bổ sung lại dữ liệu vào database.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border-2 border-dashed p-6 text-center">
            <input
              type="file"
              ref={fileInputRef}
              accept=".json"
              onChange={handleSelectJsonFile}
              className="hidden"
              id="restore-file-input"
            />
            <label
              htmlFor="restore-file-input"
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-indigo-50 px-5 py-3 text-sm font-bold text-indigo-700 hover:bg-indigo-100 transition-colors"
            >
              <FileText size={18} />
              Chọn file JSON từ máy tính
            </label>

            {restoreData && (
              <div className="mt-5 rounded-2xl border bg-slate-50 p-4 text-left">
                <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
                  <CheckCircle2 size={18} className="text-emerald-600" />
                  Đã đọc file sao lưu hợp lệ (Phiên bản: {restoreData.version || "8.x"} • Ngày xuất: {restoreData.exported_at ? new Date(restoreData.exported_at).toLocaleString("vi-VN") : "Không rõ"})
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 sm:grid-cols-4">
                  {Object.entries(restoreData.data || {}).map(([table, rows]: any) => (
                    <div key={table} className="rounded-lg border bg-white p-2">
                      <span className="font-semibold text-slate-700">{humanTable[table] || table}:</span>{" "}
                      <span className="text-blue-600 font-bold">{rows.length}</span> mục
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex items-center justify-end gap-3">
                  <button
                    onClick={() => {
                      setRestoreData(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="rounded-xl border px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-white"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    onClick={executeRestore}
                    disabled={restoring}
                    className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow hover:bg-indigo-700 disabled:opacity-50"
                  >
                    <RotateCcw size={16} />
                    {restoring ? restoreProgress || "Đang khôi phục..." : "Xác nhận khôi phục vào hệ thống"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Thùng rác 30 ngày */}
        <section className="rounded-3xl bg-white p-5 shadow-sm border sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Trash2 className="text-rose-600" size={24} />
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-800">3. THÙNG RÁC 30 NGÀY</h2>
                <p className="text-xs sm:text-sm text-slate-500">
                  Khách hàng, nhân sự và Job đã xóa sẽ được lưu giữ tạm thời 30 ngày trước khi xóa vĩnh viễn.
                </p>
              </div>
            </div>
            <button
              onClick={loadTrash}
              className="flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs sm:text-sm font-semibold hover:bg-slate-50"
            >
              <RefreshCw size={14} className={trashLoading ? "animate-spin" : ""} />
              Làm mới
            </button>
          </div>

          {!trashReady && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs sm:text-sm text-amber-900 flex items-start gap-2">
              <AlertTriangle className="shrink-0 text-amber-600" size={18} />
              <div>
                Chức năng Thùng rác yêu cầu SQL trigger hỗ trợ. Nếu chưa kích hoạt, bạn có thể chạy tệp SQL nâng cấp Thùng rác trong cơ sở dữ liệu.
              </div>
            </div>
          )}

          {trashReady && (
            <div className="overflow-x-auto rounded-2xl border">
              <table className="w-full min-w-[700px] text-xs sm:text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-slate-600 font-semibold">
                    <th className="p-3 text-left">Phân loại</th>
                    <th className="p-3 text-left">Tên mục</th>
                    <th className="p-3 text-left">Thời điểm xóa</th>
                    <th className="p-3 text-left">Người thực hiện</th>
                    <th className="p-3 text-left">Thời hạn còn lại</th>
                    <th className="p-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {trashLoading ? (
                    <tr>
                      <td className="p-6 text-center text-slate-400" colSpan={6}>
                        Đang kiểm tra thùng rác...
                      </td>
                    </tr>
                  ) : trash.length === 0 ? (
                    <tr>
                      <td className="p-8 text-center text-slate-400" colSpan={6}>
                        Thùng rác hiện đang trống.
                      </td>
                    </tr>
                  ) : (
                    trash.map((item: any) => {
                      const del = new Date(item.deleted_at);
                      const days = Math.max(
                        0,
                        30 - Math.floor((Date.now() - del.getTime()) / 86400000)
                      );
                      return (
                        <tr key={`${item.entity_type}-${item.id}`} className="hover:bg-slate-50/50">
                          <td className="p-3">
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">
                              {humanTable[item.entity_type] || item.entity_type}
                            </span>
                          </td>
                          <td className="p-3 font-semibold text-slate-900">{item.name || item.id}</td>
                          <td className="p-3 text-slate-500">{del.toLocaleString("vi-VN")}</td>
                          <td className="p-3 text-slate-600">{item.deleted_by || "Admin"}</td>
                          <td className="p-3 font-bold text-amber-600">{days} ngày</td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => restore(item)}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition-all"
                            >
                              <RotateCcw size={14} />
                              Khôi phục
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </MainLayout>
  );
}
