"use client";

import { useEffect, useMemo, useState } from "react";
import MainLayout from "../components/layout/MainLayout";
import { supabase } from "@/lib/supabase";

const money = (value: number | string | null | undefined) =>
  Number(value || 0).toLocaleString("vi-VN") + " đ";

const formatDate = (value: string | null | undefined) => {
  if (!value) return "Chưa có ngày";
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
};

const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    alert("Đã sao chép. Bạn dán vào Zalo để gửi cho thợ nhé.");
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    document.body.removeChild(area);
    alert("Đã sao chép. Bạn dán vào Zalo để gửi cho thợ nhé.");
  }
};

const buildJobMessage = (jobDay: any) => {
  const job = jobDay.jobs || {};
  const customer = job.customers || {};
  const assignments = jobDay.job_assignments || [];

  const assignmentLines = assignments.length
    ? assignments
        .map((a: any, index: number) => {
          const emp = a.employees || {};
          return [
            `${index + 1}. ${emp.full_name || "Chưa chọn thợ"} - ${a.role || "Nhiệm vụ"}`,
            `   SĐT thợ: ${emp.phone || ""}`,
            `   Địa điểm: ${a.work_location_name || ""}`,
            `   Địa chỉ: ${a.work_location_address || ""}`,
            `   SĐT tại điểm: ${a.work_location_phone || ""}`,
            `   Lương: ${money(a.salary_amount)}`,
            a.note ? `   Ghi chú: ${a.note}` : "",
          ]
            .filter(Boolean)
            .join("\n");
        })
        .join("\n\n")
    : "Chưa phân công thợ";

  return [
    "BEEN MEDIA - LỊCH CHỤP",
    "",
    `Sự kiện: ${job.event_name || customer.full_name || ""}`,
    `Khách: ${customer.full_name || job.customer_name || ""}`,
    `SĐT khách: ${customer.phone || job.customer_phone || ""}`,
    customer.secondary_phone || job.secondary_phone
      ? `SĐT phụ: ${customer.secondary_phone || job.secondary_phone}`
      : "",
    customer.address ? `Địa chỉ khách: ${customer.address}` : "",
    "",
    `Ngày: ${formatDate(jobDay.shooting_date)}`,
    `Giờ: ${jobDay.start_time || ""} - ${jobDay.end_time || ""}`,
    `Dịch vụ: ${job.service || ""}`,
    jobDay.note ? `Ghi chú ngày: ${jobDay.note}` : "",
    "",
    `Địa điểm tổng: ${jobDay.location || job.location || ""}`,
    "",
    "PHÂN CÔNG:",
    assignmentLines,
    "",
    job.note ? `Ghi chú job: ${job.note}` : "",
  ]
    .filter((line) => line !== "")
    .join("\n");
};

const buildWorkerMessage = (jobDay: any, assignment: any) => {
  const job = jobDay.jobs || {};
  const customer = job.customers || {};
  const emp = assignment.employees || {};

  return [
    "BEEN MEDIA - PHIẾU CÔNG VIỆC",
    "",
    `Chào ${emp.full_name || "anh/chị"}, BEEN MEDIA GỬI BẠN THÔNG TIN CÔNG VIỆC`,
    "",
    `Sự kiện: ${job.event_name || customer.full_name || ""}`,
    `Ngày: ${formatDate(jobDay.shooting_date)}`,
    `Thời gian: ${jobDay.start_time || ""} - ${jobDay.end_time || ""}`,
    `Nhiệm vụ: ${assignment.role || ""}`,
    `Địa điểm: ${assignment.work_location_name || ""}`,
    `Địa chỉ: ${assignment.work_location_address || jobDay.location || ""}`,
    "",
    `SĐT khách: ${customer.phone || job.customer_phone || ""}`,
    assignment.note ? `Ghi chú riêng: ${assignment.note}` : "",
    jobDay.note ? `Ghi chú ngày: ${jobDay.note}` : "",
    "",
    "Anh/chị nhận lịch xác nhận lại giúp BEEN MEDIA nhé.",
  ]
    .filter((line) => line !== "")
    .join("\n");
};

export default function SchedulePage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [jobDays, setJobDays] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedDayJobs, setSelectedDayJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  async function loadJobDays() {
    setLoading(true);
    const { data, error } = await supabase
      .from("job_days")
      .select("*, jobs(*, customers(*)), job_assignments(*, employees(*))")
      .order("shooting_date", { ascending: true });
    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    setJobDays(data || []);
  }

  useEffect(() => {
    loadJobDays();
  }, []);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();

  const calendarDays = useMemo(() => {
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDayOfMonth; i++) days.push(null);
    for (let day = 1; day <= daysInMonth; day++) days.push(day);
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [firstDayOfMonth, daysInMonth]);

  const getDateText = (day: number) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const getJobsByDay = (day: number | null) => {
    if (!day) return [];
    return jobDays.filter((item) => item.shooting_date === getDateText(day));
  };

  const monthJobs = jobDays.filter((item) =>
    String(item.shooting_date || "").startsWith(`${year}-${String(month + 1).padStart(2, "0")}`)
  );

  const openDay = (day: number) => {
    const dateText = getDateText(day);
    setSelectedDate(dateText);
    setSelectedDayJobs(jobDays.filter((item) => item.shooting_date === dateText));
  };

  const copyWholeDay = () => {
    const text = [
      `BEEN MEDIA - LỊCH NGÀY ${formatDate(selectedDate || "")}`,
      `Tổng job: ${selectedDayJobs.length}`,
      "",
      selectedDayJobs.map(buildJobMessage).join("\n\n------------------------------\n\n"),
    ].join("\n");
    copyToClipboard(text);
  };

  return (
    <MainLayout>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Lịch chụp</h1>
          <p className="text-gray-500">Bấm vào từng ngày để xem khách, job và thợ được phân công</p>
        </div>
        <a href="/job" className="bg-blue-600 text-white px-5 py-3 rounded-lg">
          + Tạo job / phân công
        </a>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl p-5 shadow"><p className="text-gray-500">Job tháng này</p><p className="text-3xl font-bold mt-2">{monthJobs.length}</p></div>
        <div className="bg-white rounded-xl p-5 shadow"><p className="text-gray-500">Tổng ngày chụp</p><p className="text-3xl font-bold mt-2">{jobDays.length}</p></div>
        <div className="bg-white rounded-xl p-5 shadow"><p className="text-gray-500">Tổng lương phát sinh</p><p className="text-2xl font-bold mt-2 text-orange-600">{money(monthJobs.reduce((s, d) => s + (d.job_assignments || []).reduce((a: number, x: any) => a + Number(x.salary_amount || 0), 0), 0))}</p></div>
      </div>

      <div className="bg-white rounded-xl shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="px-4 py-2 border rounded-lg hover:bg-gray-50">← Tháng trước</button>
          <h2 className="text-2xl font-bold">Tháng {month + 1} - {year}</h2>
          <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Tháng sau →</button>
        </div>

        {loading ? (
          <div className="p-6 text-gray-500">Đang tải lịch...</div>
        ) : (
          <div className="grid grid-cols-7 border-t border-l overflow-hidden rounded-lg">
            {["CN", "T2", "T3", "T4", "T5", "T6", "T7"].map((dayName) => (
              <div key={dayName} className="font-bold p-3 border-r border-b bg-gray-50 text-center">{dayName}</div>
            ))}

            {calendarDays.map((day, index) => {
              const jobs = getJobsByDay(day);
              return (
                <div
                  key={index}
                  onClick={() => day && openDay(day)}
                  className={`min-h-[150px] p-2 border-r border-b bg-white ${day ? "cursor-pointer hover:bg-blue-50" : "bg-slate-50"}`}
                >
                  {day && (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold">{day}</span>
                        {jobs.length > 0 && <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded-full">{jobs.length} job</span>}
                      </div>

                      <div className="space-y-2">
                        {jobs.slice(0, 3).map((jobDay) => {
                          const job = jobDay.jobs;
                          return (
                            <div key={jobDay.id} className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-xs">
                              <div className="font-bold text-blue-700">{jobDay.start_time} - {jobDay.end_time}</div>
                              <div className="font-semibold">{job?.event_name || job?.customers?.full_name || "Khách chưa rõ"}</div>
                              <div className="text-gray-500">{job?.service}</div>
                              <div className="text-gray-500">{(jobDay.job_assignments || []).length} thợ</div>
                            </div>
                          );
                        })}
                        {jobs.length > 3 && <p className="text-xs text-gray-500">+ {jobs.length - 3} job nữa</p>}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedDate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-6xl p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-5">
              <div>
                <h2 className="text-2xl font-bold">Lịch ngày {formatDate(selectedDate)}</h2>
                <p className="text-gray-500">Có {selectedDayJobs.length} job trong ngày này</p>
              </div>
              <div className="flex gap-2">
                <button onClick={copyWholeDay} className="bg-blue-600 text-white px-4 py-2 rounded-lg">📋 Sao chép cả ngày</button>
                <button onClick={() => setSelectedDate(null)} className="border px-4 py-2 rounded-lg hover:text-red-600">Đóng</button>
              </div>
            </div>

            <div className="space-y-4">
              {selectedDayJobs.map((jobDay) => {
                const job = jobDay.jobs || {};
                const customer = job.customers || {};
                const assignments = jobDay.job_assignments || [];
                return (
                  <div key={jobDay.id} className="border rounded-xl p-4">
                    <div className="flex justify-between gap-4 mb-3">
                      <div>
                        <h3 className="font-bold text-lg">{job.event_name || customer.full_name || "Khách chưa rõ"}</h3>
                        <p className="text-gray-500">{job.service} • {jobDay.start_time} - {jobDay.end_time}</p>
                        <p className="text-gray-500">Khách: {customer.full_name || job.customer_name} • {customer.phone || job.customer_phone}</p>
                        {(customer.secondary_phone || job.secondary_phone) && <p className="text-gray-500">SĐT phụ: {customer.secondary_phone || job.secondary_phone}</p>}
                        <p className="text-gray-500">Địa điểm: {jobDay.location || job.location}</p>
                      </div>
                      <div className="text-right space-y-2">
                        <p className="font-semibold">Còn nợ: <span className="text-red-600">{money(job.debt)}</span></p>
                        <p className="text-sm text-gray-500">Tổng: {money(job.total_price)}</p>
                        <button onClick={() => copyToClipboard(buildJobMessage(jobDay))} className="bg-slate-800 text-white px-3 py-2 rounded-lg">📋 Sao chép job</button>
                      </div>
                    </div>

                    <table className="w-full">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="text-left p-2">Địa điểm</th>
                          <th className="text-left p-2">Nhiệm vụ</th>
                          <th className="text-left p-2">Tên thợ</th>
                          <th className="text-left p-2">SĐT</th>
                          <th className="text-left p-2">Lương</th>
                          <th className="text-left p-2">Sao chép</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assignments.map((assignment: any) => (
                          <tr key={assignment.id} className="border-t">
                            <td className="p-2">
                              <div className="font-semibold">{assignment.work_location_name || "Chưa ghi"}</div>
                              <div className="text-xs text-gray-500">{assignment.work_location_address}</div>
                              <div className="text-xs text-gray-500">{assignment.work_location_phone}</div>
                            </td>
                            <td className="p-2">{assignment.role}</td>
                            <td className="p-2 font-semibold">{assignment.employees?.full_name || "Chưa chọn"}</td>
                            <td className="p-2">{assignment.employees?.phone}</td>
                            <td className="p-2">{money(assignment.salary_amount)}</td>
                            <td className="p-2">
                              <button onClick={() => copyToClipboard(buildWorkerMessage(jobDay, assignment))} className="border px-3 py-1 rounded hover:bg-gray-50">
                                Gửi thợ
                              </button>
                            </td>
                          </tr>
                        ))}
                        {assignments.length === 0 && <tr><td className="p-3 text-gray-500" colSpan={6}>Chưa phân công thợ.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                );
              })}
              {selectedDayJobs.length === 0 && <p className="text-gray-500">Ngày này chưa có job nào.</p>}
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
