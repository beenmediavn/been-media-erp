"use client";

import { useEffect, useMemo, useState } from "react";
import MainLayout from "../components/layout/MainLayout";
import { supabase } from "@/lib/supabase";
import type { AppUser } from "@/lib/auth";
import { formatVNDate, workerStatus } from "@/lib/workerAccess";
import { MapPin, PhoneCall, Clock3, Wallet, Copy, CheckCircle2, ChevronRight } from "lucide-react";
import { formatDateVN } from "@/lib/date-vn";

const money = (v: any) => Number(v || 0).toLocaleString("vi-VN") + " đ";

export default function WorkerJobPage({ user }: { user: AppUser }) {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "upcoming" | "done">("upcoming");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");

  // STATE XEM CHI TIẾT JOB CỦA THỢ
  const [viewingAssignment, setViewingAssignment] = useState<any>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("job_assignments")
      .select("id,role,salary_amount,work_location_name,work_location_address,work_location_phone,note,contact_visible,jobs(*, customers(*), job_days(*, job_locations(*), job_assignments(*, employees(*)))), job_days(id,shooting_date,start_time,end_time,location,note)")
      .eq("employee_id", user.id);

    setLoading(false);
    if (error) {
      if (navigator.onLine) alert(error.message);
      return;
    }
    setAssignments(data || []);
  }

  useEffect(() => {
    load();
  }, [user.id]);

  // SẮP XẾP DANH SÁCH JOB THEO THỨ TỰ NGÀY THÁNG (SỚM LÊN TRƯỚC, MUỘN XUỐNG SAU)
  const sortedAssignments = useMemo(() => {
    return [...assignments].sort((a, b) => {
      const dateA = String(a.job_days?.shooting_date || "");
      const dateB = String(b.job_days?.shooting_date || "");
      return dateA.localeCompare(dateB);
    });
  }, [assignments]);

  const totalSalary = sortedAssignments.reduce((sum, a) => sum + Number(a.salary_amount || 0), 0);

  const filteredAssignments = useMemo(() => {
    return sortedAssignments.filter((a) => {
      const dateStr = a.job_days?.shooting_date || "";
      const [year, month] = dateStr.split("-");

      if (selectedYear !== "all" && year !== selectedYear) return false;
      if (selectedMonth !== "all" && month !== selectedMonth) return false;

      const isDone = workerStatus(dateStr, a.jobs?.status).includes("Đã làm") || workerStatus(dateStr, a.jobs?.status).includes("Hoàn thành");
      if (filter === "upcoming" && isDone) return false;
      if (filter === "done" && !isDone) return false;

      return true;
    });
  }, [sortedAssignments, filter, selectedYear, selectedMonth]);

  const handleCopyJobInfo = (assignment: any) => {
    const job = assignment.jobs || {};
    const lines = [
      `📸 [BEEN MEDIA] - THÔNG TIN JOB`,
      `Sự kiện: ${job.event_name || job.customer_name || ""}`,
      `Vai trò của bạn: ${assignment.role} (${money(assignment.salary_amount)})`,
      `Khách hàng: ${job.customers?.full_name || job.customer_name || ""}`,
      `Ngày: ${formatDateVN(assignment.job_days?.shooting_date)} • ${assignment.job_days?.start_time?.slice(0, 5)} - ${assignment.job_days?.end_time?.slice(0, 5)}`,
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
      <div className="mx-auto max-w-4xl space-y-5">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl text-slate-800">Job của tôi</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">Hiển thị đầy đủ các địa điểm trong Job. SĐT tự ẩn khi Job hoàn thành.</p>
        </div>

        {/* Thẻ tổng kết */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white p-4 shadow-sm border">
            <p className="text-xs text-slate-500 font-medium">Số lượt phân công</p>
            <p className="text-2xl font-black text-slate-800 mt-1">{sortedAssignments.length}</p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm border">
            <p className="text-xs text-slate-500 font-medium">Thu nhập theo lọc</p>
            <p className="text-xl font-black text-emerald-600 mt-1">{money(filteredAssignments.reduce((s, a) => s + Number(a.salary_amount || 0), 0))}</p>
          </div>
        </div>

        {/* Thanh lọc trạng thái và thời gian */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="rounded-xl border bg-white px-3 py-2 text-xs font-semibold"
          >
            <option value="all">Tất cả các năm</option>
            <option value="2026">2026</option>
            <option value="2025">2025</option>
          </select>

          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="rounded-xl border bg-white px-3 py-2 text-xs font-semibold"
          >
            <option value="all">Cả năm (Tất cả tháng)</option>
            {Array.from({ length: 12 }, (_, i) => pad(i + 1)).map((m) => (
              <option key={m} value={m}>Tháng {m}</option>
            ))}
          </select>

          <div className="flex items-center gap-1.5 ml-auto">
            <button
              onClick={() => setFilter("all")}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${filter === "all" ? "bg-blue-600 text-white shadow-xs" : "bg-white border text-slate-700"}`}
            >
              Tất cả
            </button>
            <button
              onClick={() => setFilter("upcoming")}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${filter === "upcoming" ? "bg-blue-600 text-white shadow-xs" : "bg-white border text-slate-700"}`}
            >
              Sắp tới
            </button>
            <button
              onClick={() => setFilter("done")}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${filter === "done" ? "bg-blue-600 text-white shadow-xs" : "bg-white border text-slate-700"}`}
            >
              Đã làm
            </button>
          </div>
        </div>

        {/* Danh sách Job đã sắp xếp chuẩn ngày tháng */}
        {loading ? (
          <p className="text-xs text-slate-400">Đang tải danh sách Job...</p>
        ) : (
          <div className="space-y-3">
            {filteredAssignments.map((a) => {
              const j = a.jobs || {};
              const statusText = workerStatus(a.job_days?.shooting_date, j.status);
              const isUpcoming = !statusText.includes("Đã làm") && !statusText.includes("Hoàn thành");

              return (
                <div
                  key={a.id}
                  onClick={() => setViewingAssignment(a)}
                  className="rounded-2xl bg-white p-4 sm:p-5 border shadow-sm cursor-pointer hover:border-blue-400 hover:shadow-md transition-all space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base sm:text-lg font-bold text-slate-900">
                        {j.event_name || j.customer_name || "Job"}
                      </h2>
                      <p className="text-xs text-blue-600 font-semibold mt-0.5">{j.service || "Job"}</p>
                    </div>
                    <span className={`text-xs font-bold px-3 py-1 rounded-full border ${isUpcoming ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>
                      {statusText}
                    </span>
                  </div>

                  <div className="grid gap-1.5 text-xs sm:text-sm text-slate-700 pt-1 border-t border-slate-100">
                    <p className="flex items-center gap-2">
                      <Clock3 size={15} className="text-slate-400" />
                      <span>{formatDateVN(a.job_days?.shooting_date)} • {a.job_days?.start_time?.slice(0, 5)} - {a.job_days?.end_time?.slice(0, 5)}</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <Users size={15} className="text-slate-400" />
                      <span>Vai trò: <b className="text-blue-600">{a.role}</b></span>
                    </p>
                    <p className="flex items-center gap-2">
                      <Wallet size={15} className="text-slate-400" />
                      <span>Tiền công: <b className="text-emerald-600">{money(a.salary_amount)}</b></span>
                    </p>
                  </div>
                </div>
              );
            })}

            {filteredAssignments.length === 0 && (
              <div className="rounded-2xl bg-white p-8 text-center text-xs text-slate-400 border border-dashed">
                Không có Job nào phù hợp với bộ lọc.
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL CHI TIẾT JOB CHUẨN GIAO DIỆN THỢ */}
      {viewingAssignment && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col max-h-[92vh]">
            <div className="sticky top-0 z-20 flex items-center justify-between border-b bg-white px-5 py-3.5 rounded-t-2xl">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  {viewingAssignment.jobs?.event_name || viewingAssignment.jobs?.customer_name}
                </h2>
                <p className="text-xs text-blue-600 font-semibold">{viewingAssignment.jobs?.service || "Job"}</p>
              </div>
              <button
                onClick={() => setViewingAssignment(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4 text-xs sm:text-sm text-slate-700 flex-1">
              <div className="rounded-xl border p-3.5 bg-slate-50 space-y-1.5">
                <p className="flex items-center gap-1.5 font-bold text-slate-800">
                  <Clock3 size={15} className="text-blue-600" />
                  {formatDateVN(viewingAssignment.job_days?.shooting_date)} • {viewingAssignment.job_days?.start_time?.slice(0, 5)} - {viewingAssignment.job_days?.end_time?.slice(0, 5)}
                </p>
                <p>• Vai trò phân công: <b className="text-blue-600">{viewingAssignment.role}</b></p>
                <p>• Tiền công dự kiến: <b className="text-emerald-600">{money(viewingAssignment.salary_amount)}</b></p>
              </div>

              {/* ĐỊA ĐIỂM TRONG JOB & NHẤN MẠNH BẠN LÀM TẠI ĐÂY */}
              <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4 space-y-3">
                <p className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <MapPin size={16} className="text-blue-600" /> Địa điểm trong Job
                </p>

                {(() => {
                  const currentDay = (viewingAssignment.jobs?.job_days || []).find(
                    (d: any) => d.id === viewingAssignment.job_day_id || d.shooting_date === viewingAssignment.job_days?.shooting_date
                  ) || viewingAssignment.job_days;

                  const locations = currentDay?.job_locations || [];
                  const cust = viewingAssignment.jobs?.customers || {};
                  const isContactOpen = Boolean(viewingAssignment.contact_visible);
                  const mainPhone = cust.phone || viewingAssignment.jobs?.customer_phone || "";
                  const subPhone = cust.secondary_phone || viewingAssignment.jobs?.secondary_phone || "";

                  if (locations.length === 0) {
                    return (
                      <div className="rounded-xl bg-white p-3 border shadow-2xs space-y-1">
                        <p className="font-semibold text-slate-800">Phân công của bạn:</p>
                        <p className="text-xs text-slate-600">
                          {viewingAssignment.role} • {viewingAssignment.work_location_name || "Địa điểm"} — {viewingAssignment.work_location_address || currentDay?.location || "Chưa có địa chỉ"}
                        </p>
                      </div>
                    );
                  }

                  return locations.map((loc: any, idx: number) => {
                    const locNameLower = String(loc.location_name || "").toLowerCase();
                    const workNameLower = String(viewingAssignment.work_location_name || "").toLowerCase();
                    const isMyLocation = locNameLower.includes(workNameLower) || workNameLower.includes(locNameLower) || (locations.length === 1);

                    const isGroom = locNameLower.includes("trai");
                    const phoneToDisplay = isGroom ? mainPhone : subPhone;

                    return (
                      <div
                        key={loc.id || idx}
                        className={`rounded-xl p-3.5 border bg-white space-y-2 relative transition-all ${
                          isMyLocation ? "ring-2 ring-blue-500 border-blue-300 bg-blue-50/10 shadow-sm" : "border-slate-200"
                        }`}
                      >
                        {isMyLocation && (
                          <span className="absolute top-2.5 right-2.5 rounded-full bg-blue-600 text-white text-[10px] font-extrabold px-2.5 py-1 shadow-xs">
                            ✓ BẠN LÀM TẠI ĐÂY
                          </span>
                        )}
                        <p className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                          📍 {loc.location_name || (isGroom ? "Nhà trai" : "Nhà gái")}
                        </p>
                        <p className="text-xs text-slate-700 font-medium">{loc.address || "Chưa có địa chỉ"}</p>
                        
                        <div className="pt-1 text-xs border-t border-slate-100 flex items-center justify-between">
                          <span className="text-slate-500">SĐT liên hệ:</span>
                          {isContactOpen ? (
                            phoneToDisplay ? (
                              <a href={`tel:${phoneToDisplay}`} className="font-bold text-emerald-600 flex items-center gap-1 underline">
                                <PhoneCall size={13} /> {phoneToDisplay}
                              </a>
                            ) : (
                              <span className="text-slate-400 italic">Chưa có số điện thoại</span>
                            )
                          ) : (
                            <span className="text-amber-600 font-medium italic bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              🔒 SĐT được mở trước 48 giờ hoặc khi Admin mở sớm
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            <div className="sticky bottom-0 z-20 flex justify-end gap-2.5 border-t bg-white px-5 py-3 rounded-b-2xl">
              <button
                onClick={() => handleCopyJobInfo(viewingAssignment)}
                className="rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 text-xs flex items-center gap-1.5 shadow-sm"
              >
                <Copy size={14} /> Sao chép thông tin
              </button>
              <button
                onClick={() => setViewingAssignment(null)}
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
}"use client";

import { useEffect, useMemo, useState } from "react";
import MainLayout from "../components/layout/MainLayout";
import { supabase } from "@/lib/supabase";
import type { AppUser } from "@/lib/auth";
import { formatVNDate, workerStatus } from "@/lib/workerAccess";
import { MapPin, PhoneCall, Clock3, Wallet, Copy, CheckCircle2, ChevronRight } from "lucide-react";
import { formatDateVN } from "@/lib/date-vn";

const money = (v: any) => Number(v || 0).toLocaleString("vi-VN") + " đ";

export default function WorkerJobPage({ user }: { user: AppUser }) {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "upcoming" | "done">("upcoming");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");

  // STATE XEM CHI TIẾT JOB CỦA THỢ
  const [viewingAssignment, setViewingAssignment] = useState<any>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("job_assignments")
      .select("id,role,salary_amount,work_location_name,work_location_address,work_location_phone,note,contact_visible,jobs(*, customers(*), job_days(*, job_locations(*), job_assignments(*, employees(*)))), job_days(id,shooting_date,start_time,end_time,location,note)")
      .eq("employee_id", user.id);

    setLoading(false);
    if (error) {
      if (navigator.onLine) alert(error.message);
      return;
    }
    setAssignments(data || []);
  }

  useEffect(() => {
    load();
  }, [user.id]);

  // SẮP XẾP DANH SÁCH JOB THEO THỨ TỰ NGÀY THÁNG (SỚM LÊN TRƯỚC, MUỘN XUỐNG SAU)
  const sortedAssignments = useMemo(() => {
    return [...assignments].sort((a, b) => {
      const dateA = String(a.job_days?.shooting_date || "");
      const dateB = String(b.job_days?.shooting_date || "");
      return dateA.localeCompare(dateB);
    });
  }, [assignments]);

  const totalSalary = sortedAssignments.reduce((sum, a) => sum + Number(a.salary_amount || 0), 0);

  const filteredAssignments = useMemo(() => {
    return sortedAssignments.filter((a) => {
      const dateStr = a.job_days?.shooting_date || "";
      const [year, month] = dateStr.split("-");

      if (selectedYear !== "all" && year !== selectedYear) return false;
      if (selectedMonth !== "all" && month !== selectedMonth) return false;

      const isDone = workerStatus(dateStr, a.jobs?.status).includes("Đã làm") || workerStatus(dateStr, a.jobs?.status).includes("Hoàn thành");
      if (filter === "upcoming" && isDone) return false;
      if (filter === "done" && !isDone) return false;

      return true;
    });
  }, [sortedAssignments, filter, selectedYear, selectedMonth]);

  const handleCopyJobInfo = (assignment: any) => {
    const job = assignment.jobs || {};
    const lines = [
      `📸 [BEEN MEDIA] - THÔNG TIN JOB`,
      `Sự kiện: ${job.event_name || job.customer_name || ""}`,
      `Vai trò của bạn: ${assignment.role} (${money(assignment.salary_amount)})`,
      `Khách hàng: ${job.customers?.full_name || job.customer_name || ""}`,
      `Ngày: ${formatDateVN(assignment.job_days?.shooting_date)} • ${assignment.job_days?.start_time?.slice(0, 5)} - ${assignment.job_days?.end_time?.slice(0, 5)}`,
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
      <div className="mx-auto max-w-4xl space-y-5">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl text-slate-800">Job của tôi</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">Hiển thị đầy đủ các địa điểm trong Job. SĐT tự ẩn khi Job hoàn thành.</p>
        </div>

        {/* Thẻ tổng kết */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white p-4 shadow-sm border">
            <p className="text-xs text-slate-500 font-medium">Số lượt phân công</p>
            <p className="text-2xl font-black text-slate-800 mt-1">{sortedAssignments.length}</p>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm border">
            <p className="text-xs text-slate-500 font-medium">Thu nhập theo lọc</p>
            <p className="text-xl font-black text-emerald-600 mt-1">{money(filteredAssignments.reduce((s, a) => s + Number(a.salary_amount || 0), 0))}</p>
          </div>
        </div>

        {/* Thanh lọc trạng thái và thời gian */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="rounded-xl border bg-white px-3 py-2 text-xs font-semibold"
          >
            <option value="all">Tất cả các năm</option>
            <option value="2026">2026</option>
            <option value="2025">2025</option>
          </select>

          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="rounded-xl border bg-white px-3 py-2 text-xs font-semibold"
          >
            <option value="all">Cả năm (Tất cả tháng)</option>
            {Array.from({ length: 12 }, (_, i) => pad(i + 1)).map((m) => (
              <option key={m} value={m}>Tháng {m}</option>
            ))}
          </select>

          <div className="flex items-center gap-1.5 ml-auto">
            <button
              onClick={() => setFilter("all")}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${filter === "all" ? "bg-blue-600 text-white shadow-xs" : "bg-white border text-slate-700"}`}
            >
              Tất cả
            </button>
            <button
              onClick={() => setFilter("upcoming")}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${filter === "upcoming" ? "bg-blue-600 text-white shadow-xs" : "bg-white border text-slate-700"}`}
            >
              Sắp tới
            </button>
            <button
              onClick={() => setFilter("done")}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${filter === "done" ? "bg-blue-600 text-white shadow-xs" : "bg-white border text-slate-700"}`}
            >
              Đã làm
            </button>
          </div>
        </div>

        {/* Danh sách Job đã sắp xếp chuẩn ngày tháng */}
        {loading ? (
          <p className="text-xs text-slate-400">Đang tải danh sách Job...</p>
        ) : (
          <div className="space-y-3">
            {filteredAssignments.map((a) => {
              const j = a.jobs || {};
              const statusText = workerStatus(a.job_days?.shooting_date, j.status);
              const isUpcoming = !statusText.includes("Đã làm") && !statusText.includes("Hoàn thành");

              return (
                <div
                  key={a.id}
                  onClick={() => setViewingAssignment(a)}
                  className="rounded-2xl bg-white p-4 sm:p-5 border shadow-sm cursor-pointer hover:border-blue-400 hover:shadow-md transition-all space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base sm:text-lg font-bold text-slate-900">
                        {j.event_name || j.customer_name || "Job"}
                      </h2>
                      <p className="text-xs text-blue-600 font-semibold mt-0.5">{j.service || "Job"}</p>
                    </div>
                    <span className={`text-xs font-bold px-3 py-1 rounded-full border ${isUpcoming ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>
                      {statusText}
                    </span>
                  </div>

                  <div className="grid gap-1.5 text-xs sm:text-sm text-slate-700 pt-1 border-t border-slate-100">
                    <p className="flex items-center gap-2">
                      <Clock3 size={15} className="text-slate-400" />
                      <span>{formatDateVN(a.job_days?.shooting_date)} • {a.job_days?.start_time?.slice(0, 5)} - {a.job_days?.end_time?.slice(0, 5)}</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <Users size={15} className="text-slate-400" />
                      <span>Vai trò: <b className="text-blue-600">{a.role}</b></span>
                    </p>
                    <p className="flex items-center gap-2">
                      <Wallet size={15} className="text-slate-400" />
                      <span>Tiền công: <b className="text-emerald-600">{money(a.salary_amount)}</b></span>
                    </p>
                  </div>
                </div>
              );
            })}

            {filteredAssignments.length === 0 && (
              <div className="rounded-2xl bg-white p-8 text-center text-xs text-slate-400 border border-dashed">
                Không có Job nào phù hợp với bộ lọc.
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL CHI TIẾT JOB CHUẨN GIAO DIỆN THỢ */}
      {viewingAssignment && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col max-h-[92vh]">
            <div className="sticky top-0 z-20 flex items-center justify-between border-b bg-white px-5 py-3.5 rounded-t-2xl">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  {viewingAssignment.jobs?.event_name || viewingAssignment.jobs?.customer_name}
                </h2>
                <p className="text-xs text-blue-600 font-semibold">{viewingAssignment.jobs?.service || "Job"}</p>
              </div>
              <button
                onClick={() => setViewingAssignment(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4 text-xs sm:text-sm text-slate-700 flex-1">
              <div className="rounded-xl border p-3.5 bg-slate-50 space-y-1.5">
                <p className="flex items-center gap-1.5 font-bold text-slate-800">
                  <Clock3 size={15} className="text-blue-600" />
                  {formatDateVN(viewingAssignment.job_days?.shooting_date)} • {viewingAssignment.job_days?.start_time?.slice(0, 5)} - {viewingAssignment.job_days?.end_time?.slice(0, 5)}
                </p>
                <p>• Vai trò phân công: <b className="text-blue-600">{viewingAssignment.role}</b></p>
                <p>• Tiền công dự kiến: <b className="text-emerald-600">{money(viewingAssignment.salary_amount)}</b></p>
              </div>

              {/* ĐỊA ĐIỂM TRONG JOB & NHẤN MẠNH BẠN LÀM TẠI ĐÂY */}
              <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4 space-y-3">
                <p className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <MapPin size={16} className="text-blue-600" /> Địa điểm trong Job
                </p>

                {(() => {
                  const currentDay = (viewingAssignment.jobs?.job_days || []).find(
                    (d: any) => d.id === viewingAssignment.job_day_id || d.shooting_date === viewingAssignment.job_days?.shooting_date
                  ) || viewingAssignment.job_days;

                  const locations = currentDay?.job_locations || [];
                  const cust = viewingAssignment.jobs?.customers || {};
                  const isContactOpen = Boolean(viewingAssignment.contact_visible);
                  const mainPhone = cust.phone || viewingAssignment.jobs?.customer_phone || "";
                  const subPhone = cust.secondary_phone || viewingAssignment.jobs?.secondary_phone || "";

                  if (locations.length === 0) {
                    return (
                      <div className="rounded-xl bg-white p-3 border shadow-2xs space-y-1">
                        <p className="font-semibold text-slate-800">Phân công của bạn:</p>
                        <p className="text-xs text-slate-600">
                          {viewingAssignment.role} • {viewingAssignment.work_location_name || "Địa điểm"} — {viewingAssignment.work_location_address || currentDay?.location || "Chưa có địa chỉ"}
                        </p>
                      </div>
                    );
                  }

                  return locations.map((loc: any, idx: number) => {
                    const locNameLower = String(loc.location_name || "").toLowerCase();
                    const workNameLower = String(viewingAssignment.work_location_name || "").toLowerCase();
                    const isMyLocation = locNameLower.includes(workNameLower) || workNameLower.includes(locNameLower) || (locations.length === 1);

                    const isGroom = locNameLower.includes("trai");
                    const phoneToDisplay = isGroom ? mainPhone : subPhone;

                    return (
                      <div
                        key={loc.id || idx}
                        className={`rounded-xl p-3.5 border bg-white space-y-2 relative transition-all ${
                          isMyLocation ? "ring-2 ring-blue-500 border-blue-300 bg-blue-50/10 shadow-sm" : "border-slate-200"
                        }`}
                      >
                        {isMyLocation && (
                          <span className="absolute top-2.5 right-2.5 rounded-full bg-blue-600 text-white text-[10px] font-extrabold px-2.5 py-1 shadow-xs">
                            ✓ BẠN LÀM TẠI ĐÂY
                          </span>
                        )}
                        <p className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                          📍 {loc.location_name || (isGroom ? "Nhà trai" : "Nhà gái")}
                        </p>
                        <p className="text-xs text-slate-700 font-medium">{loc.address || "Chưa có địa chỉ"}</p>
                        
                        <div className="pt-1 text-xs border-t border-slate-100 flex items-center justify-between">
                          <span className="text-slate-500">SĐT liên hệ:</span>
                          {isContactOpen ? (
                            phoneToDisplay ? (
                              <a href={`tel:${phoneToDisplay}`} className="font-bold text-emerald-600 flex items-center gap-1 underline">
                                <PhoneCall size={13} /> {phoneToDisplay}
                              </a>
                            ) : (
                              <span className="text-slate-400 italic">Chưa có số điện thoại</span>
                            )
                          ) : (
                            <span className="text-amber-600 font-medium italic bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              🔒 SĐT được mở trước 48 giờ hoặc khi Admin mở sớm
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            <div className="sticky bottom-0 z-20 flex justify-end gap-2.5 border-t bg-white px-5 py-3 rounded-b-2xl">
              <button
                onClick={() => handleCopyJobInfo(viewingAssignment)}
                className="rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 text-xs flex items-center gap-1.5 shadow-sm"
              >
                <Copy size={14} /> Sao chép thông tin
              </button>
              <button
                onClick={() => setViewingAssignment(null)}
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
