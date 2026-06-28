"use client";

import { useEffect, useMemo, useState } from "react";
import MainLayout from "./components/layout/MainLayout";
import { supabase } from "@/lib/supabase";

const money = (value: number | string | null | undefined) =>
  Number(value || 0).toLocaleString("vi-VN") + " đ";

export default function Home() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [jobDays, setJobDays] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);

  useEffect(() => {
    async function loadData() {
      const [customerRes, jobRes, dayRes, empRes, assignmentRes] = await Promise.all([
        supabase.from("customers").select("*"),
        supabase.from("jobs").select("*, customers(*)").order("created_at", { ascending: false }),
        supabase.from("job_days").select("*, jobs(*, customers(*))").order("shooting_date", { ascending: true }),
        supabase.from("employees").select("*").eq("active", true),
        supabase.from("job_assignments").select("*, employees(*), jobs(*), job_days(*)"),
      ]);

      setCustomers(customerRes.data || []);
      setJobs(jobRes.data || []);
      setJobDays(dayRes.data || []);
      setEmployees(empRes.data || []);
      setAssignments(assignmentRes.data || []);
    }

    loadData();
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const todayJobs = jobDays.filter((item) => item.shooting_date === today);

  const summary = useMemo(() => {
    const revenue = jobs.reduce((sum, item) => sum + Number(item.total_price || 0), 0);
    const paid = jobs.reduce((sum, item) => sum + Number(item.deposit || 0), 0);
    const debt = jobs.reduce((sum, item) => sum + Number(item.debt || 0), 0);
    const salary = assignments.reduce((sum, item) => sum + Number(item.salary_amount || 0), 0);
    return { revenue, paid, debt, salary };
  }, [jobs, assignments]);

  return (
    <MainLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-gray-500 mt-1">Tổng quan hoạt động BEEN MEDIA</p>
      </div>

      <div className="grid grid-cols-4 gap-6 mb-8">
        <div className="bg-blue-600 text-white rounded-xl p-6 shadow"><h2 className="text-lg font-semibold">Khách hàng</h2><p className="text-5xl font-bold mt-4">{customers.length}</p></div>
        <div className="bg-green-600 text-white rounded-xl p-6 shadow"><h2 className="text-lg font-semibold">Job hôm nay</h2><p className="text-5xl font-bold mt-4">{todayJobs.length}</p></div>
        <div className="bg-orange-500 text-white rounded-xl p-6 shadow"><h2 className="text-lg font-semibold">Doanh thu</h2><p className="text-3xl font-bold mt-4">{money(summary.revenue)}</p></div>
        <div className="bg-red-500 text-white rounded-xl p-6 shadow"><h2 className="text-lg font-semibold">Công nợ</h2><p className="text-3xl font-bold mt-4">{money(summary.debt)}</p></div>
      </div>

      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl p-6 shadow">
          <h3 className="font-bold text-lg mb-3">Dòng tiền</h3>
          <p className="text-gray-500">Đã thu</p><p className="text-3xl font-bold text-green-700">{money(summary.paid)}</p>
          <p className="text-gray-500 mt-4">Lương thợ phát sinh</p><p className="text-3xl font-bold text-orange-600">{money(summary.salary)}</p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow">
          <h3 className="font-bold text-lg mb-3">Nhân sự</h3>
          <p className="text-gray-500">Nhân sự đang hoạt động</p><p className="text-3xl font-bold">{employees.length}</p>
          <p className="text-gray-500 mt-4">Lượt phân công</p><p className="text-3xl font-bold">{assignments.length}</p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow">
          <h3 className="font-bold text-lg mb-3">Thao tác nhanh</h3>
          <div className="space-y-3">
            <a href="/job" className="block bg-blue-600 text-white text-center rounded-lg p-3">+ Tạo job / phân công</a>
            <a href="/employees" className="block border text-center rounded-lg p-3">Quản lý nhân sự</a>
            <a href="/payments" className="block border text-center rounded-lg p-3">Xem công nợ khách</a>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow">
        <h3 className="font-bold text-lg mb-4">Lịch gần nhất</h3>
        <div className="space-y-3">
          {jobDays.slice(0, 8).map((item) => (
            <div key={item.id} className="flex justify-between border-b pb-3">
              <div>
                <p className="font-semibold">{item.jobs?.customers?.full_name || item.jobs?.service}</p>
                <p className="text-sm text-gray-500">{item.location || item.jobs?.location}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{item.shooting_date}</p>
                <p className="text-sm text-gray-500">{item.start_time} - {item.end_time}</p>
              </div>
            </div>
          ))}
          {jobDays.length === 0 && <p className="text-gray-500">Chưa có lịch chụp.</p>}
        </div>
      </div>
    </MainLayout>
  );
}
