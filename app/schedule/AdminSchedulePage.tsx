"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import MainLayout from "../components/layout/MainLayout";
import MoneyInput from "../components/MoneyInput";
import { supabase } from "@/lib/supabase";
import { ChevronLeft, ChevronRight, MapPin, Users, Clock3, Wallet, Plus, X, Save } from "lucide-react";
import { lunarShortFromISO } from "@/lib/lunar";
import Time24Input from "@/app/components/Time24Input";
import { requireEditPin } from "@/lib/admin-pin";
import { makeOfflineJobBundle, queueOfflineJob } from "@/lib/offline-job";
import { getOfflineCache, setOfflineCache } from "@/lib/offline-db";
import { formatDateVN } from "@/lib/date-vn";

const money = (v: any) => Number(v || 0).toLocaleString("vi-VN") + " đ";
const pad = (n: number) => String(n).padStart(2, "0");
const dateText = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const formatDate = (v: string) => {
  if (!v) return "";
  const [y, m, d] = v.split("-");
  return `${d}/${m}/${y}`;
};

const initialQuick = (date: string) => ({
  customer_id: "",
  full_name: "",
  phone: "",
  secondary_phone: "",
  event_name: "",
  service: "Combo VIP",
  total_price: 0,
  deposit: 0,
  status: "Đã đặt cọc",
  shooting_date: date,
  start_time: "07:00",
  end_time: "11:00",
  location_name: "Nhà trai",
  address: "",
  location_phone: "",
  note: "",
  shoot_employee: "",
  shoot_salary: 700000,
  video_employee: "",
  video_salary: 900000,
  shoot_requested: false,
  video_requested: false,
});

const DRAFT_PREFIX = "been_schedule_draft_";
const hasDraftContent = (q: any) =>
  Boolean(
    q?.customer_id ||
      q?.full_name?.trim() ||
      q?.phone?.trim() ||
      q?.event_name?.trim() ||
      q?.address?.trim() ||
      q?.note?.trim() ||
      Number(q?.total_price || 0) ||
      Number(q?.deposit || 0) ||
      q?.shoot_employee ||
      q?.video_employee
  );

export default function AdminSchedulePage() {
  const [cursor, setCursor] = useState(new Date());
  const [days, setDays] = useState<any[]>([]);
  const [selected, setSelected] = useState(() => {
    const d = new Date();
    return dateText(d.getFullYear(), d.getMonth(), d.getDate());
  });
  const [loading, setLoading] = useState(true);
  const [reserves, setReserves] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [openQuick, setOpenQuick] = useState(false);
  const [saving, setSaving] = useState(false);
  const [quick, setQuick] = useState<any>(() => initialQuick(selected));
  const [offlineDrafts, setOfflineDrafts] = useState<Record<string, any>>({});

  // STATE XEM CHI TIẾT JOB & MỞ THẲNG TRANG SỬA
  const [viewingJob, setViewingJob] = useState<any>(null);

  const year = cursor.getFullYear(),
    month = cursor.getMonth();

  async function load() {
    setLoading(true);
    const [{ data, error }, { data: reserveData, error: reserveError }, { data: customerData }, { data: employeeData }] =
      await Promise.all([
        supabase
          .from("job_days")
          .select("*, jobs(*, customers(*), job_days(*, job_locations(*), job_assignments(*, employees(*)))), job_assignments(*, employees(*))")
          .order("shooting_date", { ascending: true }),
        supabase.from("reserve_workers").select("*, employees(*)").eq("status", "reserved").order("reserve_date", { ascending: true }),
        supabase.from("customers").select("*").order("full_name"),
        supabase.from("employees").select("*").eq("active", true).is("deleted_at", null).order("full_name"),
      ]);
    setLoading(false);

    if (error || reserveError) {
      try {
        const cached = await getOfflineCache<any>("admin-schedule-data");
        if (cached?.data) {
          setDays(cached.data.days || []);
          setReserves(cached.data.reserves || []);
          setCustomers(cached.data.customers || []);
          setEmployees(cached.data.employees || []);
          return;
        }
      } catch {}
      if (navigator.onLine) alert((error || reserveError)?.message);
      return;
    }

    const activeDays = (data || []).filter((d: any) => d.jobs && !d.jobs.deleted_at);
    const activeReserves = (reserveData || []).filter((r: any) => r.employees && !r.employees.deleted_at);
    setDays(activeDays);
    setReserves(activeReserves);
    setCustomers(customerData || []);
    setEmployees(employeeData || []);
    setOfflineCache("admin-schedule-data", {
      days: activeDays,
      reserves: activeReserves,
      customers: customerData || [],
      employees: employeeData || [],
    }).catch(() => {});
  }

  useEffect(() => {
    load();
    const synced = () => load();
    window.addEventListener("been:offline-sync-complete", synced);
    return () => window.removeEventListener("been:offline-sync-complete", synced);
  }, []);

  useEffect(() => {
    try {
      const drafts: Record<string, any> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith(DRAFT_PREFIX)) {
          const date = k.slice(DRAFT_PREFIX.length);
          const raw = localStorage.getItem(k);
          if (raw) drafts[date] = JSON.parse(raw);
        }
      }
      setOfflineDrafts(drafts);
    } catch {}
  }, []);

  function persistDraft(date: string, data: any) {
    try {
      localStorage.setItem(DRAFT_PREFIX + date, JSON.stringify({ ...data, shooting_date: date, saved_at: new Date().toISOString() }));
      setOfflineDrafts((prev) => ({ ...prev, [date]: { ...data, shooting_date: date, saved_at: new Date().toISOString() } }));
    } catch {}
  }

  function clearDraft(date: string) {
    try {
      localStorage.removeItem(DRAFT_PREFIX + date);
    } catch {}
    setOfflineDrafts((prev) => {
      const n = { ...prev };
      delete n[date];
      return n;
    });
  }

  useEffect(() => {
    if (openQuick && hasDraftContent(quick)) persistDraft(selected, quick);
  }, [quick, openQuick, selected]);

  function startQuick() {
    const draft = offlineDrafts[selected];
    setQuick(draft ? { ...initialQuick(selected), ...draft, shooting_date: selected } : initialQuick(selected));
    setOpenQuick(true);
  }

  async function saveQuick() {
    if (saving) return;
    if (!quick.event_name.trim()) return alert("Vui lòng nhập tên sự kiện / tên dâu rể");
    if (!quick.full_name.trim() && !quick.customer_id) return alert("Vui lòng chọn hoặc nhập khách hàng");

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      const customerForm = {
        customer_id: quick.customer_id,
        full_name: quick.full_name,
        phone: quick.phone,
        secondary_phone: quick.secondary_phone,
        email: "",
        address: "",
        facebook: quick.full_name,
      };
      const jobForm = {
        event_name: quick.event_name,
        booking_date: new Date().toISOString().slice(0, 10),
        service: quick.service,
        total_price: quick.total_price,
        deposit: quick.deposit,
        status: quick.status,
        location: quick.address,
        note: quick.note,
        required_photo_count: quick.shoot_employee ? 1 : 0,
        required_video_count: quick.video_employee ? 1 : 0,
      };
      const assignments: any[] = [];
      if (quick.shoot_employee)
        assignments.push({
          employee_id: quick.shoot_employee,
          role: "Thợ chụp",
          salary_amount: Number(quick.shoot_salary || 0),
          note: "",
          client_requested: Boolean(quick.shoot_requested),
          contact_visible: false,
        });
      if (quick.video_employee)
        assignments.push({
          employee_id: quick.video_employee,
          role: "Thợ quay",
          salary_amount: Number(quick.video_salary || 0),
          note: "",
          client_requested: Boolean(quick.video_requested),
          contact_visible: false,
        });
      const offlineDays = [
        {
          shooting_date: selected,
          start_time: quick.start_time,
          end_time: quick.end_time,
          note: quick.note,
          locations: [
            {
              location_name: quick.location_name,
              address: quick.address,
              phone: quick.location_phone,
              note: "",
              assignments,
            },
          ],
        },
      ];
      try {
        await queueOfflineJob(makeOfflineJobBundle(customerForm, jobForm, offlineDays));
        clearDraft(selected);
        setOpenQuick(false);
        alert("Đã lưu OFFLINE. Khi có mạng, app sẽ tự đồng bộ Job lên hệ thống.");
      } catch (e: any) {
        persistDraft(selected, quick);
        alert(e?.message || "Không lưu được Job offline");
      }
      return;
    }

    setSaving(true);
    let createdJobId = "";
    try {
      let customerId = quick.customer_id;
      let customer = customers.find((c) => c.id === customerId);
      if (!customerId) {
        const { data, error } = await supabase
          .from("customers")
          .insert({
            customer_code: "KH" + Date.now(),
            full_name: quick.full_name,
            phone: quick.phone,
            secondary_phone: quick.secondary_phone,
            service: quick.service,
            total_price: Number(quick.total_price || 0),
            deposit: Number(quick.deposit || 0),
            debt: Math.max(Number(quick.total_price || 0) - Number(quick.deposit || 0), 0),
            status: quick.status,
          })
          .select("*")
          .single();
        if (error) throw error;
        customer = data;
        customerId = data.id;
      }

      const total = Number(quick.total_price || 0),
        deposit = Number(quick.deposit || 0);
      const { data: job, error: jobError } = await supabase
        .from("jobs")
        .insert({
          job_code: "JOB" + Date.now(),
          customer_id: customerId,
          customer_name: customer?.full_name || quick.full_name,
          customer_phone: customer?.phone || quick.phone,
          secondary_phone: customer?.secondary_phone || quick.secondary_phone,
          event_name: quick.event_name,
          booking_date: new Date().toISOString().slice(0, 10),
          service: quick.service,
          total_price: total,
          deposit,
          debt: Math.max(total - deposit, 0),
          status: quick.status,
          location: quick.address,
          note: quick.note,
        })
        .select("id")
        .single();
      if (jobError) throw jobError;
      createdJobId = job.id;

      if (deposit > 0) {
        const { error } = await supabase.from("customer_payments").insert({
          customer_id: customerId,
          job_id: job.id,
          amount: deposit,
          method: "Đặt cọc",
          payment_type: "Đặt cọc",
          note: "Tự tạo từ Lịch chụp",
        });
        if (error) throw error;
      }

      const { data: day, error: dayError } = await supabase
        .from("job_days")
        .insert({
          job_id: job.id,
          shooting_date: selected,
          start_time: quick.start_time,
          end_time: quick.end_time,
          location: `${quick.location_name}: ${quick.address}`,
          note: quick.note,
        })
        .select("id")
        .single();
      if (dayError) throw dayError;

      const rows: any[] = [];
      if (quick.shoot_employee)
        rows.push({
          job_id: job.id,
          job_day_id: day.id,
          employee_id: quick.shoot_employee,
          role: "Thợ chụp",
          salary_amount: Number(quick.shoot_salary || 0),
          client_requested: Boolean(quick.shoot_requested),
          work_location_name: quick.location_name,
          work_location_address: quick.address,
          work_location_phone: quick.location_phone,
        });
      if (quick.video_employee)
        rows.push({
          job_id: job.id,
          job_day_id: day.id,
          employee_id: quick.video_employee,
          role: "Thợ quay",
          salary_amount: Number(quick.video_salary || 0),
          client_requested: Boolean(quick.video_requested),
          work_location_name: quick.location_name,
          work_location_address: quick.address,
          work_location_phone: quick.location_phone,
        });
      if (rows.length) {
        const { error } = await supabase.from("job_assignments").insert(rows);
        if (error) throw error;
      }

      clearDraft(selected);
      setOpenQuick(false);
      await load();
      alert("Đã tạo Job ngay trên Lịch");
    } catch (e: any) {
      if (createdJobId) await supabase.from("jobs").delete().eq("id", createdJobId);
      persistDraft(selected, quick);
      alert((e.message || "Không tạo được Job") + "\nBản nháp đã được giữ lại trên thiết bị.");
    } finally {
      setSaving(false);
    }
  }

  const monthPrefix = `${year}-${pad(month + 1)}`,
    monthRows = days.filter((x) => String(x.shooting_date || "").startsWith(monthPrefix));

  const jobsByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const r of days) (map[r.shooting_date] ??= []).push(r);
    return map;
  }, [days]);

  const first = new Date(year, month, 1).getDay(),
    count = new Date(year, month + 1, 0).getDate();
  const cells: Array<{ d: number | null; inMonth: boolean; date?: string }> = [];
  const prevCount = new Date(year, month, 0).getDate();
  for (let i = first - 1; i >= 0; i--) cells.push({ d: prevCount - i, inMonth: false });
  for (let d = 1; d <= count; d++) cells.push({ d, inMonth: true, date: dateText(year, month, d) });
  let next = 1;
  while (cells.length < 42) cells.push({ d: next++, inMonth: false });

  const selectedJobs = jobsByDate[selected] || [];
  const selectedReserves = reserves.filter((r: any) => r.reserve_date === selected);
  const uniqueMonthJobs = Array.from(new Map(monthRows.filter((r) => r.jobs?.id).map((r) => [String(r.jobs.id), r.jobs])).values());
  const monthRevenue = uniqueMonthJobs.reduce((s: any, j: any) => s + Number(j?.total_price || 0), 0);
  const activeDates = new Set(monthRows.map((r) => r.shooting_date)).size;

  // HÀM MỞ / ĐÓNG SĐT CHO THỢ TRỰC TIẾP
  const toggleContactVisible = async (assignmentId: string, currentVal: boolean) => {
    const nextVal = !currentVal;
    const { error } = await supabase
      .from("job_assignments")
      .update({ contact_visible: nextVal })
      .eq("id", assignmentId);

    if (error) {
      alert("Lỗi khi cập nhật SĐT: " + error.message);
      return;
    }
    await load();
  };

  // SAO CHÉP LỊCH TỪNG NGÀY CHUẨN CŨ
  const copySingleDay = (day: any, dayIdx: number) => {
    const locGroom = (day.job_locations || []).find((l: any) => String(l.location_name || "").toLowerCase().includes("trai")) || {};
    const locBride = (day.job_locations || []).find((l: any) => String(l.location_name || "").toLowerCase().includes("gái")) || {};

    let text = `Ngày ${dayIdx + 1}${day.note ? ` – ${day.note}` : ""}: ${formatDateVN(day.shooting_date)} • ${day.start_time?.slice(0, 5)} - ${day.end_time?.slice(0, 5)}\n`;
    text += `Địa điểm: Nhà trai: ${locGroom.address || "Chưa có"} | Nhà gái: ${locBride.address || "Chưa có"}\n`;

    (day.job_assignments || []).forEach((a: any) => {
      text += `- ${a.role || "Thợ"}: ${a.employees?.full_name || "Chưa chọn"} | Lương: ${money(a.salary_amount)}\n`;
    });

    navigator.clipboard.writeText(text);
    alert(`Đã sao chép lịch Ngày ${dayIdx + 1}!`);
  };

  // CHUYỂN THẲNG SANG FORM SỬA JOB (KHÔNG BỊ MẤT DỮ LIỆU)
  const handleGoToEditJob = (jobId: string) => {
    window.location.href = `/job?open=${jobId}&edit=1`;
  };

  return (
    <MainLayout>
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Lịch công việc</h1>
            <p className="text-sm bm-muted">Bấm một ngày → xem Job → tạo hoặc xem/sửa Job trực tiếp tại đây.</p>
          </div>
          <button onClick={startQuick} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-bold text-white shadow-sm">
            <Plus size={19} />
            <span className="hidden sm:inline">Tạo Job ngày chọn</span>
          </button>
        </div>

        <div className="bm-card rounded-3xl p-4 shadow-xl sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <button onClick={() => setCursor(new Date(year, month - 1, 1))} className="rounded-full p-2 text-slate-700 hover:bg-slate-100">
              <ChevronLeft />
            </button>
            <div className="text-center">
              <h2 className="text-xl font-bold">
                Tháng {month + 1}, {year}
              </h2>
              <p className="mt-1 text-xs bm-muted">
                {activeDates} ngày có job • {money(monthRevenue)}
              </p>
            </div>
            <button onClick={() => setCursor(new Date(year, month + 1, 1))} className="rounded-full p-2 text-slate-700 hover:bg-slate-100">
              <ChevronRight />
            </button>
          </div>
          <div className="grid grid-cols-7 text-center text-xs font-bold bm-muted">
            {["CN", "T2", "T3", "T4", "T5", "T6", "T7"].map((x, i) => (
              <div key={x} className={i === 0 || i === 6 ? "text-red-400" : ""}>
                {x}
              </div>
            ))}
          </div>
          {loading ? (
            <div className="py-12 text-center bm-muted">Đang tải lịch...</div>
          ) : (
            <div className="been-calendar mt-3 grid grid-cols-7 gap-y-2">
              {cells.map((c, i) => {
                const has = c.inMonth && !!jobsByDate[c.date!]?.length,
                  hasReserve = c.inMonth && reserves.some((r: any) => r.reserve_date === c.date),
                  sel = c.date === selected;
                return (
                  <button
                    key={i}
                    disabled={!c.inMonth}
                    onClick={() => c.date && setSelected(c.date)}
                    className={`relative mx-auto grid h-11 w-11 place-items-center rounded-full text-sm font-bold transition ${
                      !c.inMonth
                        ? "text-slate-300"
                        : sel
                        ? "bg-blue-600 text-white ring-4 ring-blue-100"
                        : has
                        ? "bg-emerald-700 text-white ring-2 ring-emerald-100"
                        : "text-slate-800 hover:bg-blue-50 hover:text-blue-700"
                    }`}
                  >
                    <span className="leading-none">{c.d}</span>
                    {c.inMonth && c.date && (
                      <span className={`absolute -bottom-1 text-[9px] font-medium ${sel || has ? "text-white/90" : "text-slate-400"}`}>
                        {lunarShortFromISO(c.date)}
                      </span>
                    )}
                    {hasReserve && !sel && <span className="absolute right-0 top-0 h-2 w-2 rounded-full bg-blue-600 ring-2 ring-white" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* DANH SÁCH JOB TRONG NGÀY ĐANG CHỌN */}
        <div className="mt-5">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">Ngày {formatDate(selected)}</h2>
              <p className="text-sm bm-muted">
                {selectedJobs.length} job • {selectedReserves.length} thợ dự phòng
              </p>
            </div>
            <button onClick={startQuick} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm">
              + {selectedJobs.length ? "Thêm Job trong ngày này" : "Tạo Job ngày này"}
            </button>
          </div>

          <div className="space-y-3">
            {selectedJobs.map((r: any) => {
              const j = r.jobs || {},
                debt = Math.max(Number(j.debt ?? (Number(j.total_price || 0) - Number(j.deposit || 0))), 0),
                requested = (r.job_assignments || []).filter((a: any) => a.client_requested);

              return (
                <div
                  key={r.id}
                  onClick={() => setViewingJob(j)}
                  className={`bm-card rounded-3xl p-4 sm:p-5 cursor-pointer transition hover:border-blue-400 hover:shadow-md ${
                    requested.length ? "ring-2 ring-red-400" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-bold text-slate-800">{j.event_name || j.customers?.full_name || j.customer_name || "Chưa có tên"}</p>
                      <p className="text-sm bm-gold">{j.service || "Job"}</p>
                      {requested.length > 0 && (
                        <p className="mt-2 rounded-lg bg-red-500/10 px-2 py-1 text-xs font-bold text-red-600">
                          🔴 ⭐ THỢ KHÁCH CHỈ ĐỊNH: {requested.map((a: any) => a.employees?.full_name || "Thợ").join(", ")}
                        </p>
                      )}
                    </div>
                    <span className="bm-chip rounded-full px-3 py-1 text-xs font-bold">{j.status || "Đã đặt"}</span>
                  </div>

                  <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                    <p className="flex gap-2 items-center text-slate-700">
                      <Clock3 size={17} className="bm-gold" />
                      {r.start_time || "--:--"} - {r.end_time || "--:--"}
                    </p>
                    <p className="flex gap-2 items-center text-slate-700">
                      <MapPin size={17} className="bm-gold" />
                      <span className="truncate">{r.location || j.location || "Chưa nhập địa điểm"}</span>
                    </p>
                    <p className="flex gap-2 items-center text-slate-700">
                      <Users size={17} className="bm-gold" />
                      {(r.job_assignments || []).length} thợ được phân công
                    </p>
                    <p className="flex gap-2 items-center">
                      <Wallet size={17} className="bm-gold" />
                      <span className={debt > 0 ? "font-semibold text-rose-600" : "text-emerald-600"}>
                        {debt > 0 ? `Khách còn nợ ${money(debt)}` : "Đã thanh toán đủ"}
                      </span>
                    </p>
                  </div>

                  <div className="mt-4 flex justify-end" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => setViewingJob(j)}
                      className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 transition shadow-xs"
                    >
                      Xem / sửa Job →
                    </button>
                  </div>
                </div>
              );
            })}
            {selectedJobs.length === 0 && (
              <div className="bm-card rounded-3xl border-2 border-dashed border-slate-200 py-10 text-center bm-muted">
                Ngày này chưa có Job. Bấm “Tạo Job ngày này” để tạo ngay tại đây.
              </div>
            )}
          </div>
        </div>

        {/* MODAL XEM CHI TIẾT JOB: CHUẨN 100% GIAO DIỆN CŨ (BẢNG 7 CỘT + NÚT MỞ SỚM + NÚT SỬA JOB CHUYỂN THẲNG FORM) */}
        {viewingJob && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-sm overflow-y-auto">
            <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[92vh]">
              {/* Header Popup */}
              <div className="sticky top-0 z-20 flex items-center justify-between border-b bg-white px-6 py-4 rounded-t-2xl">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-800">
                    {viewingJob.event_name || viewingJob.job_code}
                  </h2>
                  <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500">
                    <span className="font-mono">{viewingJob.job_code}</span>
                    <span>•</span>
                    <span className="font-semibold text-slate-700">{viewingJob.customers?.full_name || viewingJob.customer_name}</span>
                    <span>•</span>
                    <span>{viewingJob.service}</span>
                    <span>•</span>
                    <span className="rounded bg-blue-100 text-blue-800 px-2 py-0.5 font-bold">
                      {viewingJob.status || "Đã đặt cọc"}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setViewingJob(null)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 font-bold"
                  title="Đóng (Esc)"
                >
                  ✕
                </button>
              </div>

              {/* Nội dung chi tiết Job: Bảng 7 cột chuẩn cũ */}
              <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-700 flex-1">
                {/* 4 Thẻ tài chính */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl border p-3 bg-white shadow-xs">
                    <p className="text-slate-500">Tổng tiền hợp đồng</p>
                    <p className="text-lg font-black text-slate-800 mt-1">{money(viewingJob.total_price)}</p>
                  </div>
                  <div className="rounded-xl border p-3 bg-emerald-50/50 shadow-xs">
                    <p className="text-slate-500">Đã thanh toán / Cọc</p>
                    <p className="text-lg font-black text-emerald-600 mt-1">{money(viewingJob.deposit)}</p>
                  </div>
                  <div className="rounded-xl border p-3 bg-rose-50/50 shadow-xs">
                    <p className="text-slate-500">Khách còn nợ</p>
                    <p className="text-lg font-black text-rose-600 mt-1">{money(viewingJob.debt)}</p>
                  </div>
                  <div className="rounded-xl border p-3 bg-white shadow-xs">
                    <p className="text-slate-500">Số ngày quay/chụp</p>
                    <p className="text-lg font-black text-slate-800 mt-1">{(viewingJob.job_days || []).length} ngày</p>
                  </div>
                </div>

                {/* Danh sách từng ngày & Bảng 7 cột y như ảnh cũ */}
                <div className="space-y-4">
                  {(viewingJob.job_days || []).map((day: any, idx: number) => {
                    const locGroom = (day.job_locations || []).find((l: any) => String(l.location_name || "").toLowerCase().includes("trai")) || {};
                    const locBride = (day.job_locations || []).find((l: any) => String(l.location_name || "").toLowerCase().includes("gái")) || {};

                    const groomAddr = locGroom.address || viewingJob.customers?.address || "";
                    const brideAddr = locBride.address || "";

                    return (
                      <div key={day.id || idx} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
                        <div className="flex items-center justify-between border-b pb-2">
                          <h3 className="font-bold text-slate-800 text-sm">
                            Ngày {idx + 1}{day.note ? ` – ${day.note}` : ""}: {formatDateVN(day.shooting_date)} • {day.start_time?.slice(0, 5)} - {day.end_time?.slice(0, 5)}
                          </h3>
                          <button
                            type="button"
                            onClick={() => copySingleDay(day, idx)}
                            className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1 font-semibold text-blue-600 hover:bg-blue-100 transition-colors"
                          >
                            📋 Sao chép ngày này
                          </button>
                        </div>

                        <p className="text-xs text-slate-500">
                          <span className="font-semibold text-slate-700">Địa điểm: </span>
                          Nhà trai: {groomAddr || "Chưa cập nhật"} | Nhà gái: {brideAddr || "Chưa cập nhật"}
                        </p>

                        {/* BẢNG 7 CỘT CHI TIẾT */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs min-w-[750px] border rounded-xl overflow-hidden">
                            <thead className="border-b bg-slate-50 text-slate-600 font-semibold">
                              <tr>
                                <th className="p-2.5">Địa điểm</th>
                                <th className="p-2.5">Địa chỉ / SĐT</th>
                                <th className="p-2.5">Vai trò</th>
                                <th className="p-2.5">Thợ</th>
                                <th className="p-2.5">Lương</th>
                                <th className="p-2.5 text-center">SĐT cho thợ</th>
                                <th className="p-2.5">Ghi chú</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y text-slate-700 bg-white">
                              {(day.job_assignments || []).map((a: any) => {
                                const isGroom = String(a.work_location_name || "").toLowerCase().includes("trai");
                                const address = isGroom ? (groomAddr || a.work_location_address) : (brideAddr || a.work_location_address);
                                const phone = isGroom ? (viewingJob.customers?.phone || viewingJob.customer_phone) : (viewingJob.customers?.secondary_phone || viewingJob.secondary_phone);

                                return (
                                  <tr key={a.id} className="hover:bg-slate-50/70">
                                    <td className="p-2.5 font-bold text-slate-800">{a.work_location_name || (isGroom ? "Nhà trai" : "Nhà gái")}</td>
                                    <td className="p-2.5">
                                      <div className="font-medium text-slate-800">{address || "Chưa nhập địa chỉ"}</div>
                                      {phone && <div className="text-[11px] text-slate-500 font-mono mt-0.5">{phone}</div>}
                                    </td>
                                    <td className="p-2.5 text-slate-600">{a.role}</td>
                                    <td className="p-2.5 font-bold text-slate-900">{a.employees?.full_name || "Chưa xếp thợ"}</td>
                                    <td className="p-2.5 font-bold text-slate-800">{money(a.salary_amount)}</td>
                                    <td className="p-2.5 text-center">
                                      {a.contact_visible ? (
                                        <button
                                          type="button"
                                          onClick={() => toggleContactVisible(a.id, true)}
                                          className="rounded bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                                          title="Bấm để ẩn SĐT"
                                        >
                                          Đang mở
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => toggleContactVisible(a.id, false)}
                                          className="rounded bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 border hover:bg-slate-200"
                                          title="Bấm để mở SĐT cho thợ xem ngay"
                                        >
                                          Mở sớm
                                        </button>
                                      )}
                                    </td>
                                    <td className="p-2.5 text-slate-500">{a.note || "-"}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* FOOTER: BẤM SỬA JOB LÀ MỞ THẲNG VÀO FORM SỬA JOB NÀY */}
              <div className="sticky bottom-0 z-20 flex justify-end gap-2.5 border-t bg-white px-6 py-4 rounded-b-2xl">
                <button
                  type="button"
                  onClick={() => setViewingJob(null)}
                  className="rounded-xl border px-4 py-2 font-semibold hover:bg-slate-50 text-xs"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={() => handleGoToEditJob(viewingJob.id)}
                  className="rounded-xl bg-amber-500 px-5 py-2 font-bold text-white hover:bg-amber-600 shadow-sm text-xs flex items-center gap-1.5"
                >
                  ✏️ Sửa job này
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Form tạo nhanh */}
        {openQuick && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 p-3">
            <div className="bm-card max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-3xl p-5 sm:p-6">
              <div className="mb-5 flex justify-between">
                <div>
                  <h2 className="text-2xl font-bold bm-gold">Tạo Job ngày {formatDate(selected)}</h2>
                  <p className="text-sm bm-muted">Form này lưu Job trực tiếp từ Lịch. Không chuyển sang Job / Booking.</p>
                </div>
                <button onClick={() => setOpenQuick(false)}>
                  <X />
                </button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-semibold">
                  Khách hàng có sẵn
                  <select
                    value={quick.customer_id}
                    onChange={(e) => {
                      const c = customers.find((x) => x.id === e.target.value);
                      setQuick((q: any) => ({
                        ...q,
                        customer_id: e.target.value,
                        full_name: c?.full_name || q.full_name,
                        phone: c?.phone || q.phone,
                        secondary_phone: c?.secondary_phone || q.secondary_phone,
                      }));
                    }}
                    className="mt-1 w-full rounded-xl border p-3"
                  >
                    <option value="">-- Khách mới --</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.full_name} • {c.phone}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-semibold">
                  Tên khách hàng
                  <input
                    value={quick.full_name}
                    onChange={(e) => setQuick({ ...quick, full_name: e.target.value })}
                    className="mt-1 w-full rounded-xl border p-3"
                    placeholder="Tên người book"
                  />
                </label>
                <label className="text-sm font-semibold">
                  SĐT chính
                  <input
                    value={quick.phone}
                    onChange={(e) => setQuick({ ...quick, phone: e.target.value })}
                    className="mt-1 w-full rounded-xl border p-3"
                  />
                </label>
                <label className="text-sm font-semibold">
                  SĐT phụ / cô dâu
                  <input
                    value={quick.secondary_phone}
                    onChange={(e) => setQuick({ ...quick, secondary_phone: e.target.value })}
                    className="mt-1 w-full rounded-xl border p-3"
                  />
                </label>
                <label className="sm:col-span-2 text-sm font-semibold">
                  Tên sự kiện / tên dâu rể
                  <input
                    value={quick.event_name}
                    onChange={(e) => setQuick({ ...quick, event_name: e.target.value })}
                    className="mt-1 w-full rounded-xl border p-3"
                    placeholder="Ví dụ: TUẤN & THU THỦY"
                  />
                </label>
                <label className="text-sm font-semibold">
                  Gói dịch vụ
                  <input
                    value={quick.service}
                    onChange={(e) => setQuick({ ...quick, service: e.target.value })}
                    className="mt-1 w-full rounded-xl border p-3"
                  />
                </label>
                <label className="text-sm font-semibold">
                  Trạng thái
                  <select
                    value={quick.status}
                    onChange={(e) => setQuick({ ...quick, status: e.target.value })}
                    className="mt-1 w-full rounded-xl border p-3"
                  >
                    <option>Đã đặt cọc</option>
                    <option>Đã xác nhận</option>
                    <option>Hoàn thành</option>
                  </select>
                </label>
                <label className="text-sm font-semibold">
                  Tổng tiền Job
                  <MoneyInput
                    value={quick.total_price}
                    onChange={(v: number) => setQuick({ ...quick, total_price: v })}
                    className="mt-1 w-full rounded-xl border p-3"
                    placeholder="10.000.000"
                  />
                </label>
                <label className="text-sm font-semibold">
                  Đã thu / Đặt cọc
                  <MoneyInput
                    value={quick.deposit}
                    onChange={(v: number) => setQuick({ ...quick, deposit: v })}
                    className="mt-1 w-full rounded-xl border p-3"
                    placeholder="1.000.000"
                  />
                </label>
                <div className="sm:col-span-2 rounded-xl bg-black/10 p-3 text-sm">
                  Khách còn nợ — tự động tính:{" "}
                  <b className="text-red-600">{money(Math.max(Number(quick.total_price) - Number(quick.deposit), 0))}</b>
                </div>
                <label className="text-sm font-semibold">
                  Từ giờ
                  <Time24Input
                    value={quick.start_time}
                    onChange={(value: string) => setQuick({ ...quick, start_time: value })}
                    className="mt-1 w-full rounded-xl border p-3"
                  />
                </label>
                <label className="text-sm font-semibold">
                  Đến giờ
                  <Time24Input
                    value={quick.end_time}
                    onChange={(value: string) => setQuick({ ...quick, end_time: value })}
                    className="mt-1 w-full rounded-xl border p-3"
                  />
                </label>
                <label className="text-sm font-semibold">
                  Tên địa điểm / nhà
                  <input
                    value={quick.location_name}
                    onChange={(e) => setQuick({ ...quick, location_name: e.target.value })}
                    className="mt-1 w-full rounded-xl border p-3"
                  />
                </label>
                <label className="text-sm font-semibold">
                  SĐT tại địa điểm
                  <input
                    value={quick.location_phone}
                    onChange={(e) => setQuick({ ...quick, location_phone: e.target.value })}
                    className="mt-1 w-full rounded-xl border p-3"
                  />
                </label>
                <label className="sm:col-span-2 text-sm font-semibold">
                  Địa chỉ
                  <input
                    value={quick.address}
                    onChange={(e) => setQuick({ ...quick, address: e.target.value })}
                    className="mt-1 w-full rounded-xl border p-3"
                  />
                </label>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <label className="text-sm font-semibold">
                    Thợ chụp
                    <select
                      value={quick.shoot_employee}
                      onChange={(e) => setQuick({ ...quick, shoot_employee: e.target.value })}
                      className="mt-1 w-full rounded-xl border p-3"
                    >
                      <option value="">-- Chưa chọn --</option>
                      {employees.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.full_name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="mt-3 block text-sm font-semibold">
                    Tiền công chụp
                    <MoneyInput
                      value={quick.shoot_salary}
                      onChange={(v: number) => setQuick({ ...quick, shoot_salary: v })}
                      className="mt-1 w-full rounded-xl border p-3"
                    />
                  </label>
                  <label className="mt-3 flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={quick.shoot_requested}
                      onChange={(e) => setQuick({ ...quick, shoot_requested: e.target.checked })}
                    />{" "}
                    ⭐ Khách chỉ định thợ này
                  </label>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <label className="text-sm font-semibold">
                    Thợ quay
                    <select
                      value={quick.video_employee}
                      onChange={(e) => setQuick({ ...quick, video_employee: e.target.value })}
                      className="mt-1 w-full rounded-xl border p-3"
                    >
                      <option value="">-- Chưa chọn --</option>
                      {employees.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.full_name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="mt-3 block text-sm font-semibold">
                    Tiền công quay
                    <MoneyInput
                      value={quick.video_salary}
                      onChange={(v: number) => setQuick({ ...quick, video_salary: v })}
                      className="mt-1 w-full rounded-xl border p-3"
                    />
                  </label>
                  <label className="mt-3 flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={quick.video_requested}
                      onChange={(e) => setQuick({ ...quick, video_requested: e.target.checked })}
                    />{" "}
                    ⭐ Khách chỉ định thợ này
                  </label>
                </div>
                <label className="sm:col-span-2 text-sm font-semibold">
                  Ghi chú Job
                  <textarea
                    value={quick.note}
                    onChange={(e) => setQuick({ ...quick, note: e.target.value })}
                    className="mt-1 min-h-24 w-full rounded-xl border p-3"
                  />
                </label>
              </div>
              <div className="mt-5 flex justify-end gap-3">
                <button onClick={() => setOpenQuick(false)} className="rounded-xl border border-slate-200 px-4 py-2">
                  Hủy
                </button>
                <button
                  disabled={saving}
                  onClick={saveQuick}
                  className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 font-bold text-white"
                >
                  <Save size={18} />
                  {saving ? "Đang lưu..." : "Lưu Job"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
