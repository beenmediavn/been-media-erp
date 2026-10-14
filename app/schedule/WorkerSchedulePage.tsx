"use client";

import { useEffect, useMemo, useState } from "react";
import MainLayout from "../components/layout/MainLayout";
import { supabase } from "@/lib/supabase";
import { getOfflineCache, setOfflineCache } from "@/lib/offline-db";
import type { AppUser } from "@/lib/auth";
import { formatVNDate, workerStatus } from "@/lib/workerAccess";
import { lunarShortFromISO } from "@/lib/lunar";
import { CalendarCheck, Clock3, MapPin, Users, Wallet, X, Copy } from "lucide-react";
import { formatDateVN } from "@/lib/date-vn";

const pad = (n: number) => String(n).padStart(2, "0");
const money = (v: any) => Number(v || 0).toLocaleString("vi-VN") + " đ";

export default function WorkerSchedulePage({ user }: { user: AppUser }) {
  const now = new Date();
  const [cursor, setCursor] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [rows, setRows] = useState<any[]>([]);
  const [reserveRows, setReserveRows] = useState<any[]>([]);
  const [selected, setSelected] = useState(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
  const [loading, setLoading] = useState(true);

  // STATE XEM CHI TIẾT JOB TRÊN GIAO DIỆN THỢ
  const [viewingJob, setViewingJob] = useState<any>(null);

  async function load() {
    setLoading(true);
    const [
      { data: jobData, error: jobError },
      { data: resData, error: resError }
    ] = await Promise.all([
      supabase
        .from("job_assignments")
        .select("id,role,salary_amount,work_location_name,work_location_address,work_location_phone,note,contact_visible,jobs(*, customers(*), job_days(*, job_locations(*), job_assignments(*, employees(*)))), job_days(id,shooting_date,start_time,end_time,location,note)")
        .eq("employee_id", user.id),
      supabase
        .from("reserve_workers")
        .select("id,reserve_date,start_time,end_time,role,note,status")
        .eq("employee_id", user.id)
        .eq("status", "reserved")
    ]);

    setLoading(false);

    if (jobError) {
      try {
        const cached = await getOfflineCache<any[]>(`worker-schedule-${user.id}`);
        if (cached?.data) {
          setRows(cached.data);
          return;
        }
      } catch {}
      if (navigator.onLine) alert(jobError.message);
      return;
    }

    setRows(jobData || []);
    setReserveRows(resData || []);
    setOfflineCache(`worker-schedule-${user.id}`, jobData || []).catch(() => {});
  }

  useEffect(() => {
    load();
  }, [user.id]);

  const y = cursor.getFullYear();
  const m = cursor.getMonth();
  const prefix = `${y}-${pad(m + 1)}`;
  const monthRows = rows.filter((r) => String(r.job_days?.shooting_date || "").startsWith(prefix));

  const map = useMemo(() => {
    const x: Record<string, any[]> = {};
    for (const r of rows) {
      const d = r.job_days?.shooting_date;
      if (d) (x[d] ??= []).push(r);
    }
    // SẮP XẾP CÁC JOB TRONG NGÀY THEO THỜI GIAN (GIỜ BẮT ĐẦU SỚM LÊN TRƯỚC)
    for (const dateKey of Object.keys(x)) {
      x[dateKey].sort((a: any, b: any) => {
        const timeA = String(a.job_days?.start_time || "00:00");
        const timeB = String(b.job_days?.start_time || "00:00");
        return timeA.localeCompare(timeB);
      });
    }
    return x;
  }, [rows]);

  const reserveMap = useMemo(() => {
    const x: Record<string, any[]> = {};
    for (const r of reserveRows) {
      const d = r.reserve_date;
      if (d) (x[d] ??= []).push(r);
    }
    return x;
  }, [reserveRows]);

  const first = new Date(y, m, 1).getDay();
  const cnt = new Date(y, m + 1, 0).getDate();
  const cells: any[] = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= cnt; d++) cells.push(d);
  while (cells.length % 7) cells.push(null);

  const selectedRows = map[selected] || [];
  const selectedReserves = reserveMap[selected] || [];

  const handleCopyJobInfo = (job: any) => {
    const lines = [
      `📸 [BEEN MEDIA] - THÔNG TIN JOB`,
      `Sự kiện: ${job.event_name || job.customer_name || ""}`,
      `Dịch vụ: ${job.service || ""}`,
      `Khách hàng: ${job.customers?.full_name || job.customer_name || ""}`,
      `----------------------------------------`,
    ];
    (job.job_days || []).forEach((d: any, idx: number) => {
      lines.push(
        `📅 Ngày ${idx + 1}${d.note ? ` (${d.note})` : ""}: ${formatDateVN(d.shooting_date)} • ${d.start_time?.slice(0, 5)} - ${d.end_time?.slice(0, 5)}`,
        `📍 Địa điểm: ${d.location || "Chưa nhập"}`
      );
    });
    navigator.clipboard.writeText(lines.join("\n"));
    alert("Đã sao chép thông tin Job!");
  };

  return (
    <MainLayout>
      <div className="mx-auto max-w-5xl space-y-5">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl text-slate-800">Lịch công việc của tôi</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">Lịch phân công và lịch làm việc của bạn</p>
        </div>

        {/* Lịch tháng */}
        <div className="rounded-3xl bg-white p-4 shadow-sm border sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <button
              onClick={() => setCursor(new Date(y, m - 1, 1))}
              className="rounded-xl border px-3 py-2 hover:bg-slate-50 font-bold"
            >
              ‹
            </button>
            <div className="text-center">
              <b className="text-lg sm:text-xl text-slate-800">
                Tháng {m + 1}, {y}
              </b>
              <p className="text-xs text-slate-500 mt-0.5">{monthRows.length} lượt công việc</p>
            </div>
            <button
              onClick={() => setCursor(new Date(y, m + 1, 1))}
              className="rounded-xl border px-3 py-2 hover:bg-slate-50 font-bold"
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 text-center text-xs font-bold text-slate-500 mb-2">
            {["CN", "T2", "T3", "T4", "T5", "T6", "T7"].map((x) => (
              <div key={x}>{x}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-2">
            {cells.map((d, i) => {
              if (!d) return <div key={i} />;
              const date = `${y}-${pad(m + 1)}-${pad(d)}`;
              const hasJob = !!map[date]?.length;
              const hasReserve = !!reserveMap[date]?.length;
              const sel = date === selected;

              return (
                <button
                  key={i}
                  onClick={() => setSelected(date)}
                  className={`relative mx-auto grid h-11 w-11 place-items-center rounded-full text-sm font-bold transition-all ${
                    sel
                      ? "bg-blue-600 text-white shadow"
                      : hasJob
                      ? "bg-emerald-700 text-white"
                      : hasReserve
                      ? "bg-amber-100 text-amber-900 border border-amber-300"
                      : "text-slate-800 hover:bg-slate-100"
                  }`}
                >
                  <span className="leading-none">{d}</span>
                  <span
                    className={`absolute -bottom-1 text-[9px] font-medium ${
                      sel || hasJob ? "text-white/90" : hasReserve ? "text-amber-800" : "text-slate-400"
                    }`}
                  >
                    {lunarShortFromISO(date)}
                  </span>
                  {hasReserve && !hasJob && (
                    <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Chi tiết ngày được chọn */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b pb-2">
            <h2 className="text-base sm:text-lg font-bold text-slate-800">
              Ngày {formatVNDate(selected)}
            </h2>
            <span className="text-xs text-slate-500 font-medium">
              {selectedRows.length + selectedReserves.length} lịch làm việc
            </span>
          </div>

          {selectedReserves.length > 0 && (
            <div className="space-y-2">
              {selectedReserves.map((res: any) => (
                <div
                  key={res.id}
                  className="rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-sm flex items-start gap-3"
                >
                  <CalendarCheck className="text-amber-600 shrink-0 mt-0.5" size={20} />
                  <div className="text-xs sm:text-sm text-amber-950 space-y-1">
                    <p className="font-bold text-amber-900 text-sm">
                      BẠN ĐANG ĐƯỢC XẾP LỊCH NGÀY NÀY CỦA STUDIO
                    </p>
                    <p className="flex items-center gap-1 font-semibold text-slate-700">
                      <Clock3 size={14} className="text-amber-600" />
                      {res.start_time
                        ? `${String(res.start_time).slice(0, 5)}${res.end_time ? ` – ${String(res.end_time).slice(0, 5)}` : ""}`
                        : "Cả ngày"}{" "}
                      • Vai trò: {res.role || "Nhân sự"}
                    </p>
                    {res.note && <p className="text-xs text-slate-600 italic">Ghi chú: {res.note}</p>}
                    <p className="font-semibold text-rose-600 pt-0.5">
                      Vui lòng giữ lịch và không nhận job ngoài trong thời gian này!
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Danh sách Job đã phân công - Bấm vào mở thẳng modal thông tin job */}
          {loading ? (
            <p className="text-xs text-slate-400">Đang tải lịch...</p>
          ) : (
            <div className="space-y-3">
              {selectedRows.map((a) => {
                const j = a.jobs || {};
                return (
                  <div
                    key={a.id}
                    onClick={() => setViewingJob(j)}
                    className="block rounded-2xl bg-white p-4 shadow-sm border cursor-pointer hover:border-blue-400 hover:shadow-md transition-all"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <b className="text-sm sm:text-base text-slate-800">
                          {j.event_name || j.customer_name || "Job"}
                        </b>
                        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                          {a.job_days?.start_time?.slice(0, 5)} - {a.job_days?.end_time?.slice(0, 5)} • Vai trò: <span className="font-bold text-blue-600">{a.role}</span>
                        </p>
                        <p className="mt-1 text-xs text-slate-600 font-medium flex items-center gap-1">
                          <MapPin size={13} className="text-slate-400" />
                          {a.work_location_name || "Địa điểm"} • {a.work_location_address || a.job_days?.location || "Chưa có địa chỉ"}
                        </p>
                      </div>
                      <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
                        {workerStatus(a.job_days?.shooting_date, j.status)}
                      </span>
                    </div>
                  </div>
                );
              })}

              {selectedRows.length === 0 && selectedReserves.length === 0 && (
                <div className="rounded-2xl bg-white p-8 text-center text-xs sm:text-sm text-slate-400 border border-dashed">
                  Ngày này bạn không có lịch.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* MODAL XEM CHI TIẾT JOB DÀNH CHO THỢ KHI BẤM VÀO LỊCH */}
      {viewingJob && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[92vh]">
            <div className="sticky top-0 z-20 flex items-center justify-between border-b bg-white px-6 py-4 rounded-t-2xl">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-800">
                  {viewingJob.event_name || viewingJob.customer_name}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Dịch vụ: {viewingJob.service || "Job"} • Trạng thái: {viewingJob.status}</p>
              </div>
              <button
                onClick={() => setViewingJob(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs sm:text-sm text-slate-700 flex-1">
              <div className="rounded-xl border p-3.5 bg-slate-50 space-y-2">
                <p className="font-bold text-slate-800 text-sm">👤 Thông tin khách hàng:</p>
                <p>• Tên khách: <b>{viewingJob.customers?.full_name || viewingJob.customer_name}</b></p>
                <p>• SĐT chính (Nhà trai): <a href={`tel:${viewingJob.customers?.phone || viewingJob.customer_phone}`} className="font-bold text-blue-600 underline">{viewingJob.customers?.phone || viewingJob.customer_phone || "Chưa có"}</a></p>
                <p>• SĐT phụ (Nhà gái): <a href={`tel:${viewingJob.customers?.secondary_phone || viewingJob.secondary_phone}`} className="font-bold text-blue-600 underline">{viewingJob.customers?.secondary_phone || viewingJob.secondary_phone || "Chưa có"}</a></p>
              </div>

              <div className="space-y-3">
                <p className="font-bold text-slate-800 text-sm">📅 Lịch trình các ngày trong Job:</p>
                {[...(viewingJob.job_days || [])]
                  .sort((a: any, b: any) => String(a.shooting_date || "").localeCompare(String(b.shooting_date || "")))
                  .map((d: any, idx: number) => (
                    <div key={d.id || idx} className="rounded-xl border p-3.5 bg-white space-y-1.5 shadow-2xs">
                      <p className="font-bold text-blue-700">Ngày {idx + 1}: {formatDateVN(d.shooting_date)} ({d.start_time?.slice(0, 5)} - {d.end_time?.slice(0, 5)})</p>
                      <p className="text-slate-600">📍 Địa điểm: {d.location || "Chưa cập nhật"}</p>
                      {d.note && <p className="text-slate-500 italic">Ghi chú: {d.note}</p>}
                    </div>
                  ))}
              </div>
            </div>

            <div className="sticky bottom-0 z-20 flex justify-end gap-2.5 border-t bg-white px-6 py-3 rounded-b-2xl">
              <button
                onClick={() => handleCopyJobInfo(viewingJob)}
                className="rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 text-xs flex items-center gap-1.5 shadow-sm"
              >
                <Copy size={14} /> Sao chép thông tin
              </button>
              <button
                onClick={() => setViewingJob(null)}
                className="rounded-xl border px-4 py-2 font-semibold hover:bg-slate-50 text-xs"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
