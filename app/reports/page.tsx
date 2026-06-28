"use client";

import { useEffect, useMemo, useState } from "react";
import MainLayout from "../components/layout/MainLayout";
import { supabase } from "@/lib/supabase";

const money = (value: number | string | null | undefined) =>
  Number(value || 0).toLocaleString("vi-VN") + " đ";

export default function ReportsPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);

  useEffect(() => {
    async function loadData() {
      const [{ data: jobData }, { data: empData }, { data: assignmentData }] = await Promise.all([
        supabase.from("jobs").select("*, customers(*), job_days(*)"),
        supabase.from("employees").select("*"),
        supabase.from("job_assignments").select("*, employees(*), jobs(*), job_days(*)"),
      ]);
      setJobs(jobData || []);
      setEmployees(empData || []);
      setAssignments(assignmentData || []);
    }
    loadData();
  }, []);

  const report = useMemo(() => {
    const revenue = jobs.reduce((s, j) => s + Number(j.total_price || 0), 0);
    const paid = jobs.reduce((s, j) => s + Number(j.deposit || 0), 0);
    const debt = jobs.reduce((s, j) => s + Number(j.debt || 0), 0);
    const salary = assignments.reduce((s, a) => s + Number(a.salary_amount || 0), 0);
    return { revenue, paid, debt, salary, profit: revenue - salary };
  }, [jobs, assignments]);

  return (
    <MainLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Báo cáo</h1>
        <p className="text-gray-500 mt-1">Doanh thu, công nợ, lương thợ và lợi nhuận dự kiến</p>
      </div>

      <div className="grid grid-cols-5 gap-4 mb-6">
        <Card title="Doanh thu" value={money(report.revenue)} />
        <Card title="Đã thu" value={money(report.paid)} color="text-green-700" />
        <Card title="Công nợ" value={money(report.debt)} color="text-red-600" />
        <Card title="Lương thợ" value={money(report.salary)} color="text-orange-600" />
        <Card title="Lãi dự kiến" value={money(report.profit)} color="text-blue-700" />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-xl font-bold mb-4">Job gần nhất</h2>
          <div className="space-y-3">
            {jobs.slice(0, 10).map((job) => (
              <div key={job.id} className="border rounded-xl p-3 flex justify-between gap-4">
                <div>
                  <p className="font-semibold">{job.customers?.full_name || job.service}</p>
                  <p className="text-sm text-gray-500">{job.service}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{money(job.total_price)}</p>
                  <p className="text-sm text-red-600">Nợ {money(job.debt)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-xl font-bold mb-4">Lương theo nhân sự</h2>
          <div className="space-y-3">
            {employees.map((employee) => {
              const salary = assignments
                .filter((a) => a.employee_id === employee.id)
                .reduce((s, a) => s + Number(a.salary_amount || 0), 0);
              return (
                <div key={employee.id} className="border rounded-xl p-3 flex justify-between">
                  <div>
                    <p className="font-semibold">{employee.full_name}</p>
                    <p className="text-sm text-gray-500">{employee.role}</p>
                  </div>
                  <p className="font-bold text-orange-600">{money(salary)}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

function Card({ title, value, color = "" }: { title: string; value: string; color?: string }) {
  return (
    <div className="bg-white rounded-xl p-5 shadow">
      <p className="text-gray-500">{title}</p>
      <p className={`text-2xl font-bold mt-2 ${color}`}>{value}</p>
    </div>
  );
}
