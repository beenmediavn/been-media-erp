"use client";

import { useEffect, useMemo, useState } from "react";
import MainLayout from "../components/layout/MainLayout";
import { supabase } from "@/lib/supabase";
import { formatDateVN } from "@/lib/date-vn";
import { PhoneCall, MapPin, Clock, Wallet } from "lucide-react";

const money = (value: number | string | null | undefined) =>
  Number(value || 0).toLocaleString("vi-VN") + " đ";

export default function WorkerJobPage({ user }: { user: any }) {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingAssignment, setViewingAssignment] = useState<any>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("job_assignments")
      .select("id, role, salary_amount, note, client_requested, contact_visible, work_location_name, work_location_address, work_location_phone, job_days(shooting_date, start_time, end_time, note), jobs(id, job_code, event_name, customer_name, customer_phone, secondary_phone, service, total_price, deposit, note, customers(full_name, phone, secondary_phone, address, facebook))")
      .eq("employee_id", user?.id)
      .order("created_at", { ascending: false });

    setLoading(false);
    if (!error && data) {
      setAssignments(data);
    }
  }

  useEffect(() => {
    if (user?.id) load();
  }, [user?.id]);

  return (
    <MainLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Lịch Job Cá Nhân</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Danh sách các job và phân công công việc của bạn
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="border-b bg-slate-50 text-[11px] font-semibold uppercase text-slate-600">
              <tr>
                <th className="p-3.5">Mã Job / Sự kiện</th>
                <th className="p-3.5">Ngày chụp</th>
                <th className="p-3.5">Thời gian</th>
                <th className="p-3.5">Vai trò</th>
                <th className="p-3.5">Địa điểm & SĐT</th>
                <th className="p-3.5 text-right">Lương</th>
                <th className="p-3.5 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y text-slate-700">
              {assignments.map((item: any) => {
                const job = item.jobs || {};
                const day = item.job_days || {};
                return (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900">{job.job_code}</div>
                      <div className="text-slate-700 font-semibold">{job.event_name}</div>
                    </td>
                    <td className="p-3.5 whitespace-nowrap font-medium">
                      {formatDateVN(day.shooting_date)}
                    </td>
                    <td className="p-3.5 whitespace-nowrap">
                      {day.start_time?.slice(0, 5)} - {day.end_time?.slice(0, 5)}
                    </td>
                    <td className="p-3.5 font-semibold text-blue-700">
                      {item.role} {item.client_requested ? "⭐" : ""}
                    </td>
                    <td className="p-3.5">
                      <div className="font-bold text-slate-800">{item.work_location_name || "Địa điểm chính"}</div>
                      <div className="text-slate-500">{item.work_location_address || job.customers?.address || "Chưa có địa chỉ"}</div>
                      <div className="text-emerald-700 font-mono font-bold mt-0.5">
                        {item.contact_visible !== false ? (item.work_location_phone || job.customers?.phone || "Chưa có SĐT") : "🔒 SĐT sẽ mở trước 2 ngày"}
                      </div>
                    </td>
                    <td className="p-3.5 text-right font-bold text-slate-800">
                      {money(item.salary_amount)}
                    </td>
                    <td className="p-3.5 text-center">
                      <button
                        onClick={() => setViewingAssignment(item)}
                        className="rounded-lg bg-slate-800 px-3 py-1 font-semibold text-white hover:bg-slate-900"
                      >
                        Chi tiết
                      </button>
                    </td>
                  </tr>
                );
              })}
              {assignments.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-400">
                    Chưa có lịch job nào được phân công.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {viewingAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg space-y-4 shadow-xl text-xs">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-sm text-slate-800">Chi tiết phân công công việc</h3>
              <button onClick={() => setViewingAssignment(null)} className="font-bold text-slate-400 hover:text-slate-700">✕</button>
            </div>
            <div className="space-y-2">
              <p><span className="font-semibold text-slate-500">Sự kiện:</span> <span className="font-bold text-slate-800">{viewingAssignment.jobs?.event_name}</span></p>
              <p><span className="font-semibold text-slate-500">Vai trò của bạn:</span> <span className="font-bold text-blue-700">{viewingAssignment.role}</span></p>
              <p><span className="font-semibold text-slate-500">Địa điểm làm việc:</span> <span className="font-bold">{viewingAssignment.work_location_name} - {viewingAssignment.work_location_address}</span></p>
              <p><span className="font-semibold text-slate-500">Số điện thoại liên hệ:</span> <span className="font-mono font-bold text-emerald-700">{viewingAssignment.contact_visible !== false ? (viewingAssignment.work_location_phone || viewingAssignment.jobs?.customers?.phone) : "Chưa mở (Sẽ mở trước 2 ngày)"}</span></p>
              <p><span className="font-semibold text-slate-500">Tiền công:</span> <span className="font-bold text-slate-900">{money(viewingAssignment.salary_amount)}</span></p>
              {viewingAssignment.note && <p><span className="font-semibold text-slate-500">Ghi chú riêng:</span> {viewingAssignment.note}</p>}
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setViewingAssignment(null)}
                className="px-4 py-2 bg-slate-800 text-white rounded-xl font-semibold"
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
