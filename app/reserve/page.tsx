"use client";

import { useEffect, useMemo, useState } from "react";
import MainLayout from "../components/layout/MainLayout";
import EmployeePicker from "../components/EmployeePicker";
import { supabase } from "@/lib/supabase";
import { CalendarDays, Clock3, Plus, Trash2, Users, AlertCircle, CheckCircle2, X } from "lucide-react";
import { requireEditPin } from "@/lib/admin-pin";
import Time24Input from "../components/Time24Input";

const pad2 = (n: number) => String(n).padStart(2, "0");
const localDateInput = (d = new Date()) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const formatDate = (v: string) => {
  if (!v) return "";
  const [y, m, d] = v.split("-");
  return `${d}/${m}/${y}`;
};
const formatTime = (v?: string | null) => String(v || "").slice(0, 5);

function normalizeRole(value?: string) {
  const v = String(value || "").toLowerCase();
  if (v.includes("photo") || v.includes("chụp") || v.includes("chup")) return "Thợ chụp";
  if (v.includes("video") || v.includes("quay") || v.includes("camera")) return "Thợ quay";
  if (v.includes("fly")) return "Flycam";
  if (v.includes("edit")) return "Editor";
  if (v.includes("live")) return "Livestream";
  if (v.includes("make")) return "Makeup";
  if (v.includes("lái") || v.includes("lai xe") || v.includes("driver")) return "Lái xe";
  return value || "Thợ chụp";
}

type StatusFilter = "reserved" | "used" | "all";

export default function ReserveWorkersPage() {
  const today = localDateInput();
  const [employees, setEmployees] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [reserveDate, setReserveDate] = useState(today);
  const [viewDate, setViewDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [role, setRole] = useState("Thợ chụp");
  const [note, setNote] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("reserved");
  const [saving, setSaving] = useState(false);
  const [scheduleDays, setScheduleDays] = useState<any[]>([]);
  const [selectedReserve, setSelectedReserve] = useState<any | null>(null);

  async function syncAndLoad() {
    const [
      { data: emp, error: empError },
      { data: res, error: resError },
      { data: dayData, error: dayError }
    ] = await Promise.all([
      supabase.from("employees").select("*").eq("active", true).is("deleted_at", null).order("full_name"),
      supabase.from("reserve_workers").select("*, employees(*)").order("reserve_date").order("start_time", { ascending: true, nullsFirst: true }),
      supabase.from("job_days").select("id, shooting_date, start_time, end_time, jobs(id, event_name, customer_name, status, deleted_at), job_assignments(employee_id)")
    ]);

    if (empError) {
      alert(`Không tải được nhân sự: ${empError.message}`);
      return;
    }
    if (resError) {
      alert(`Không tải được thợ dự phòng: ${resError.message}`);
      return;
    }
    if (dayError) {
      console.warn("Không tải được lịch để kiểm tra trùng thợ dự phòng:", dayError.message);
    }

    const currentRows = res || [];
    const validDays = (dayData || []).filter((d: any) => {
      const j = Array.isArray(d.jobs) ? d.jobs[0] : d.jobs;
      return !j?.deleted_at && j?.status !== "Đã hủy" && j?.status !== "Hủy";
    });

    // Tự động kiểm tra đối soát an toàn kiểu dữ liệu
    const toUpdate: { id: string; assigned_job_id: string }[] = [];
    currentRows.forEach((r: any) => {
      if (r.status === "reserved") {
        const matchedDay = validDays.find((d: any) => {
          if (d.shooting_date !== r.reserve_date) return false;
          return (d.job_assignments || []).some((a: any) => String(a.employee_id) === String(r.employee_id));
        });
        if (matchedDay) {
          const matchedJob = Array.isArray(matchedDay.jobs) ? matchedDay.jobs[0] : matchedDay.jobs;
          const assignedId = matchedJob?.id || "";
          toUpdate.push({ id: r.id, assigned_job_id: assignedId });
          r.status = "used";
          r.assigned_job_id = assignedId;
        }
      }
    });

    if (toUpdate.length > 0) {
      for (const item of toUpdate) {
        if (item.assigned_job_id) {
          await supabase.from("reserve_workers").update({
            status: "used",
            assigned_job_id: item.assigned_job_id,
            assigned_at: new Date().toISOString()
          }).eq("id", item.id);
        }
      }
    }

    setEmployees(emp || []);
    setRows(currentRows);
    setScheduleDays(validDays);
  }

  useEffect(() => {
    syncAndLoad();
  }, []);

  function reserveConflicts(id: string) {
    if (!id || !reserveDate) return [] as any[];
    const toMin = (v?: string | null) => {
      const m = String(v || "").match(/^(\d{1,2}):(\d{2})/);
      return m ? Number(m[1]) * 60 + Number(m[2]) : null;
    };
    const wantedStart = toMin(startTime);
    const wantedEnd = toMin(endTime);

    return scheduleDays.filter((d: any) => {
      if (d.shooting_date !== reserveDate) return false;
      if (!(d.job_assignments || []).some((a: any) => String(a.employee_id) === String(id))) return false;
      if (wantedStart === null) return true;
      const jobStart = toMin(d.start_time);
      const jobEnd = toMin(d.end_time);
      if (jobStart === null) return true;
      const wEnd = wantedEnd ?? 24 * 60;
      const jEnd = jobEnd ?? 24 * 60;
      return wantedStart < jEnd && jobStart < wEnd;
    });
  }

  const selectedConflicts = reserveConflicts(employeeId);
  const conflictText = (d: any) => {
    const j = Array.isArray(d.jobs) ? d.jobs[0] : d.jobs;
    return `${formatTime(d.start_time) || "Chưa rõ giờ"}${d.end_time ? `–${formatTime(d.end_time)}` : ""} • ${j?.event_name || j?.customer_name || "Job"}`;
  };

  async function save() {
    if (!reserveDate) return alert("Vui lòng chọn ngày dự phòng");
    if (!employeeId) return alert("Vui lòng chọn thợ dự phòng");
    if (startTime && endTime && endTime <= startTime) return alert("Giờ kết thúc phải lớn hơn giờ bắt đầu");

    const conflicts = reserveConflicts(employeeId);
    if (conflicts.length) {
      const name = employees.find((e) => e.id === employeeId)?.full_name || "Thợ này";
      const detail = conflicts.map((d: any) => `• ${conflictText(d)}`).join("\n");
      if (!confirm(`⚠ CẢNH BÁO TRÙNG LỊCH\n\n${name} đã có Job trong ${startTime ? "khung giờ dự phòng này" : "ngày này"}:\n${detail}\n\nVẫn chốt người này làm thợ dự phòng?`)) {
        return;
      }
    }

    setSaving(true);
    try {
      let query = supabase.from("reserve_workers").select("id").eq("reserve_date", reserveDate).eq("employee_id", employeeId).eq("status", "reserved");
      if (startTime) query = query.eq("start_time", startTime);
      else query = query.is("start_time", null);

      const { data: existing, error: findError } = await query.limit(1);
      if (findError) throw findError;

      const payload = {
        reserve_date: reserveDate,
        start_time: startTime || null,
        end_time: endTime || null,
        employee_id: employeeId,
        role,
        note,
        status: "reserved",
        assigned_job_id: null,
        assigned_at: null,
      };

      if (existing?.length) {
        const { error } = await supabase.from("reserve_workers").update(payload).eq("id", existing[0].id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("reserve_workers").insert(payload);
        if (error) throw error;
      }

      setStatusFilter("reserved");
      await syncAndLoad();
      alert(`Đã chốt giữ lịch ${employees.find((e) => e.id === employeeId)?.full_name || "nhân sự"} ngày ${formatDate(reserveDate)}${startTime ? ` • ${startTime}${endTime ? `–${endTime}` : ""}` : " • Cả ngày"}`);
      setNote("");
    } catch (err: any) {
      alert(`Không lưu được thợ dự phòng: ${err?.message || String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!(await requireEditPin("xóa thợ dự phòng"))) return;
    if (!confirm("Bỏ thợ này khỏi danh sách dự phòng?")) return;
    const { error } = await supabase.from("reserve_workers").delete().eq("id", id);
    if (error) return alert(error.message);
    syncAndLoad();
    if (selectedReserve?.id === id) setSelectedReserve(null);
  }

  const visibleRows = useMemo(() => {
    return rows
      .filter((r: any) => {
        if (viewDate && r.reserve_date !== viewDate) return false;
        if (statusFilter === "all") return r.status !== "cancelled";
        return r.status === statusFilter;
      })
      .sort((a: any, b: any) => String(a.reserve_date).localeCompare(String(b.reserve_date)) || String(a.start_time || "").localeCompare(String(b.start_time || "")));
  }, [rows, viewDate, statusFilter]);

  const activeCount = rows.filter((r: any) => (!viewDate || r.reserve_date === viewDate) && r.status === "reserved").length;
  const usedCount = rows.filter((r: any) => (!viewDate || r.reserve_date === viewDate) && r.status === "used").length;

  const groupedRows = useMemo(() => {
    const groups = new Map<string, any[]>();
    for (const r of visibleRows) {
      const key = r.reserve_date || "";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }
    return Array.from(groups.entries());
  }, [visibleRows]);

  return (
    <MainLayout>
      <div className="mx-auto max-w-6xl space-y-5">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl text-slate-800">Thợ dự phòng</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Quản lý và giữ lịch thợ dự phòng theo ngày. Khi thợ được xếp vào Job trùng lịch, hệ thống sẽ tự động chuyển sang "Đã xếp Job" và cảnh báo giữ lịch cho thợ.
          </p>
        </div>

        {/* Khung cảnh báo giữ lịch chung */}
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-sm flex items-start gap-3">
          <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={20} />
          <div className="text-xs sm:text-sm text-amber-900 leading-relaxed">
            <b>CẢNH BÁO GIỮ LỊCH:</b> Thợ nằm trong danh sách <b>"Đang dự phòng"</b> phải giữ lịch trong ngày/khung giờ đã chốt và không được nhận Job ngoài. Khi thợ được xếp vào Job chính thức, hệ thống sẽ tự động gỡ khỏi danh sách dự phòng.
          </div>
        </div>

        {/* Form thêm thợ dự phòng */}
        <div className="rounded-2xl bg-white p-4 shadow-sm border sm:p-5">
          <div className="mb-4 flex items-center gap-2 font-bold text-slate-800 text-sm sm:text-base">
            <Plus size={18} className="text-blue-600" /> Chốt thợ dự phòng
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6 text-xs sm:text-sm">
            <label className="text-slate-600 font-medium">
              Ngày <span className="text-rose-500">*</span>
              <input
                type="date"
                value={reserveDate}
                onChange={(e) => setReserveDate(e.target.value)}
                className="mt-1 w-full rounded-xl border p-2.5 focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <label className="text-slate-600 font-medium">
              Giờ bắt đầu <span className="text-slate-400 text-xs">(tùy chọn)</span>
              <Time24Input
                value={startTime}
                onChange={setStartTime}
                className="mt-1 w-full rounded-xl border p-2.5 focus:ring-2 focus:ring-blue-500"
                placeholder="07:00"
              />
            </label>
            <label className="text-slate-600 font-medium">
              Giờ kết thúc <span className="text-slate-400 text-xs">(tùy chọn)</span>
              <Time24Input
                value={endTime}
                onChange={setEndTime}
                className="mt-1 w-full rounded-xl border p-2.5 focus:ring-2 focus:ring-blue-500"
                placeholder="11:00"
              />
            </label>
            <label className="text-slate-600 font-medium">
              Chọn thợ <span className="text-rose-500">*</span>
              <EmployeePicker
                employees={employees}
                value={employeeId}
                onChange={(id) => {
                  setEmployeeId(id);
                  const emp = employees.find((x) => x.id === id);
                  if (emp?.role) setRole(normalizeRole(emp.role));
                  if (id) {
                    const hits = reserveConflicts(id);
                    if (hits.length) {
                      alert(`⚠ ${emp?.full_name || "Thợ này"} đã có Job ${startTime ? "trùng khung giờ" : "trong ngày"}:\n${hits.map((d: any) => `• ${conflictText(d)}`).join("\n")}\n\nVẫn có thể chốt nếu Admin xác nhận.`);
                    }
                  }
                }}
                getConflict={() => null}
              />
            </label>
            <label className="text-slate-600 font-medium">
              Vai trò
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="mt-1 w-full rounded-xl border p-2.5 font-semibold focus:ring-2 focus:ring-blue-500"
              >
                <option>Thợ chụp</option>
                <option>Thợ quay</option>
                <option>Flycam</option>
                <option>Editor</option>
                <option>Livestream</option>
                <option>Makeup</option>
                <option>Lái xe</option>
              </select>
            </label>
            <button
              onClick={save}
              disabled={saving}
              className="self-end rounded-xl bg-blue-600 py-2.5 px-4 font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-all text-xs sm:text-sm"
            >
              {saving ? "Đang lưu..." : "+ Chốt dự phòng"}
            </button>
          </div>

          {employeeId && selectedConflicts.length > 0 && (
            <div className="mt-3 rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs text-rose-800">
              <b>⚠ Thợ này đã có lịch {startTime ? "trùng khung giờ" : "trong ngày"}:</b>
              {selectedConflicts.map((d: any) => (
                <div key={d.id} className="mt-1 font-medium">• {conflictText(d)}</div>
              ))}
            </div>
          )}

          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="mt-3 w-full rounded-xl border p-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500"
            placeholder="Ghi chú: ưu tiên job cưới, đã trao đổi riêng với thợ..."
          />
        </div>

        {/* Danh sách & Bộ lọc */}
        <div className="rounded-2xl bg-white p-4 shadow-sm border sm:p-5">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap items-end gap-2">
              <button
                onClick={() => setViewDate("")}
                className={`rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold transition-all ${!viewDate ? "bg-blue-600 text-white shadow-sm" : "border bg-white text-slate-700 hover:bg-slate-50"}`}
              >
                Tất cả ngày
              </button>
              <label className="text-xs sm:text-sm font-semibold text-slate-700">
                Lọc theo ngày
                <input
                  type="date"
                  value={viewDate}
                  onChange={(e) => setViewDate(e.target.value)}
                  className="mt-1 block rounded-xl border p-2 text-xs sm:text-sm"
                />
              </label>
              {viewDate && (
                <button
                  onClick={() => setViewDate("")}
                  className="rounded-xl border bg-white px-3 py-2 text-xs font-semibold hover:bg-slate-50"
                >
                  Bỏ lọc
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              <button
                onClick={() => setStatusFilter("reserved")}
                className={`rounded-full px-3.5 py-1.5 text-xs sm:text-sm font-bold transition-all ${statusFilter === "reserved" ? "bg-blue-600 text-white shadow-sm" : "border bg-white text-slate-700 hover:bg-slate-50"}`}
              >
                Đang dự phòng ({activeCount})
              </button>
              <button
                onClick={() => setStatusFilter("used")}
                className={`rounded-full px-3.5 py-1.5 text-xs sm:text-sm font-bold transition-all ${statusFilter === "used" ? "bg-emerald-600 text-white shadow-sm" : "border bg-white text-slate-700 hover:bg-slate-50"}`}
              >
                Đã xếp Job ({usedCount})
              </button>
              <button
                onClick={() => setStatusFilter("all")}
                className={`rounded-full px-3.5 py-1.5 text-xs sm:text-sm font-bold transition-all ${statusFilter === "all" ? "bg-slate-800 text-white shadow-sm" : "border bg-white text-slate-700 hover:bg-slate-50"}`}
              >
                Tất cả ({rows.length})
              </button>
            </div>
          </div>

          <div className="mb-3 flex items-center justify-between border-b pb-2">
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <CalendarDays size={18} className="text-blue-600" />
              <b className="text-slate-800">{viewDate ? `Ngày ${formatDate(viewDate)}` : "Tất cả ngày đã chốt"}</b>
            </div>
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700">
              {visibleRows.length} người
            </span>
          </div>

          {visibleRows.length > 0 ? (
            <div className="space-y-5">
              {groupedRows.map(([date, items]) => (
                <section key={date}>
                  <div className="mb-2 flex items-center gap-2 border-b pb-1.5">
                    <CalendarDays size={16} className="text-blue-600" />
                    <h3 className="font-extrabold text-sm text-slate-800">{formatDate(date)}</h3>
                    <span className="text-xs text-slate-400">({items.length} người)</span>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {items.map((r: any) => (
                      <div
                        key={r.id}
                        onClick={() => setSelectedReserve(r)}
                        className={`cursor-pointer flex items-center justify-between rounded-2xl border p-3.5 transition-all hover:shadow-sm ${
                          r.status === "used"
                            ? "bg-emerald-50/50 border-emerald-200"
                            : "bg-white border-slate-200 hover:border-blue-300"
                        }`}
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-bold text-sm text-slate-900 truncate">
                              {r.employees?.full_name || "Nhân sự"}
                            </p>
                            {r.status === "used" ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                <CheckCircle2 size={11} /> Đã xếp Job
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                                <Clock3 size={11} /> Đang giữ lịch
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">{r.role}</p>
                          <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-slate-600">
                            <Clock3 size={12} />
                            {r.start_time ? `${formatTime(r.start_time)}${r.end_time ? ` – ${formatTime(r.end_time)}` : ""}` : "Cả ngày"}
                          </p>
                          {r.note && <p className="mt-1 truncate text-[11px] text-slate-400">{r.note}</p>}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            remove(r.id);
                          }}
                          className="rounded-xl p-2 text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                          title="Hủy dự phòng"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-dashed py-12 text-center text-slate-400">
              <Users className="mx-auto mb-2 opacity-50" size={32} />
              <p className="text-xs sm:text-sm">
                {viewDate ? "Ngày này chưa có thợ phù hợp bộ lọc." : "Chưa có thợ dự phòng phù hợp bộ lọc."}
              </p>
            </div>
          )}
        </div>

        {/* MODAL CHI TIẾT THỢ DỰ PHÒNG (CÓ NÚT X DÍNH TRÊN ĐẦU) */}
        {selectedReserve && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto">
            <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
              <div className="sticky top-0 z-20 flex items-center justify-between border-b bg-white px-5 py-4">
                <div>
                  <h3 className="font-bold text-base text-slate-800">Chi tiết thợ dự phòng</h3>
                  <p className="text-xs text-slate-400">{selectedReserve.employees?.full_name}</p>
                </div>
                <button
                  onClick={() => setSelectedReserve(null)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 font-bold"
                  title="Đóng (Esc)"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-5 space-y-3.5 text-xs text-slate-700">
                <div className="flex justify-between items-center py-1.5 border-b">
                  <span className="text-slate-500">Trạng thái:</span>
                  {selectedReserve.status === "used" ? (
                    <span className="font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      ✓ Đã xếp vào Job
                    </span>
                  ) : (
                    <span className="font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                      ⚠ Đang giữ lịch (Không nhận job ngoài)
                    </span>
                  )}
                </div>
                <div className="flex justify-between items-center py-1.5 border-b">
                  <span className="text-slate-500">Ngày dự phòng:</span>
                  <span className="font-bold text-slate-800">{formatDate(selectedReserve.reserve_date)}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b">
                  <span className="text-slate-500">Khung giờ:</span>
                  <span className="font-semibold text-slate-800">
                    {selectedReserve.start_time
                      ? `${formatTime(selectedReserve.start_time)}${selectedReserve.end_time ? ` – ${formatTime(selectedReserve.end_time)}` : ""}`
                      : "Cả ngày"}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b">
                  <span className="text-slate-500">Vai trò:</span>
                  <span className="font-semibold text-slate-800">{selectedReserve.role}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b">
                  <span className="text-slate-500">Số điện thoại:</span>
                  <span className="font-semibold text-slate-800">{selectedReserve.employees?.phone || "Chưa có"}</span>
                </div>
                {selectedReserve.note && (
                  <div className="py-1.5">
                    <span className="text-slate-500 block mb-1">Ghi chú:</span>
                    <p className="bg-slate-50 p-2.5 rounded-xl border text-slate-700">{selectedReserve.note}</p>
                  </div>
                )}

                <div className="pt-3 flex gap-2">
                  <button
                    onClick={() => remove(selectedReserve.id)}
                    className="flex-1 rounded-xl bg-rose-600 py-2.5 font-bold text-white hover:bg-rose-700 transition-colors"
                  >
                    Xóa khỏi dự phòng
                  </button>
                  <button
                    onClick={() => setSelectedReserve(null)}
                    className="flex-1 rounded-xl border py-2.5 font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
