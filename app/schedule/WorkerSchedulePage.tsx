"use client";

import { useEffect, useMemo, useState } from "react";
import MainLayout from "../components/layout/MainLayout";
import { supabase } from "@/lib/supabase";
import { getOfflineCache, setOfflineCache } from "@/lib/offline-db";
import type { AppUser } from "@/lib/auth";
import { formatVNDate, workerStatus } from "@/lib/workerAccess";
import Link from "next/link";
import { lunarShortFromISO } from "@/lib/lunar";
import { CalendarCheck, Clock3 } from "lucide-react";

const pad = (n: number) => String(n).padStart(2, "0");

export default function WorkerSchedulePage({ user }: { user: AppUser }) {
  const now = new Date();
  const [cursor, setCursor] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [rows, setRows] = useState<any[]>([]);
  const [reserveRows, setReserveRows] = useState<any[]>([]);
  const [selected, setSelected] = useState(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [
      { data: jobData, error: jobError },
      { data: resData, error: resError }
    ] = await Promise.all([
      supabase
        .from("job_assignments")
        .select("id,role,salary_amount,work_location_name,work_location_address,work_location_phone,note,contact_visible,jobs(id,event_name,customer_name,status,service),job_days(id,shooting_date,start_time,end_time,location,note)")
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

          {/* CẢNH BÁO GIỮ LỊCH KÍN ĐÁO KHÔNG BỊ LỘ TỪ 'DỰ PHÒNG' */}
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

          {/* Danh sách Job đã phân công */}
          {loading ? (
            <p className="text-xs text-slate-400">Đang tải lịch...</p>
          ) : (
            <div className="space-y-3">
              {selectedRows.map((a) => (
                <Link
                  href="/job"
                  key={a.id}
                  className="block rounded-2xl bg-white p-4 shadow-sm border hover:border-blue-300 transition-all"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <b className="text-sm sm:text-base text-slate-800">
                        {a.jobs?.event_name || a.jobs?.customer_name || "Job"}
                      </b>
                      <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                        {a.job_days?.start_time} - {a.job_days?.end_time} • {a.role}
                      </p>
                      <p className="mt-1 text-xs text-slate-600 font-medium">
                        {a.work_location_name} • {a.work_location_address || a.job_days?.location}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
                      {workerStatus(a.job_days?.shooting_date, a.jobs?.status)}
                    </span>
                  </div>
                </Link>
              ))}

              {selectedRows.length === 0 && selectedReserves.length === 0 && (
                <div className="rounded-2xl bg-white p-8 text-center text-xs sm:text-sm text-slate-400 border border-dashed">
                  Ngày này bạn không có lịch.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
