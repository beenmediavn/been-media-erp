"use client";

import { useEffect, useMemo, useState } from "react";
import MainLayout from "../components/layout/MainLayout";
import { supabase } from "@/lib/supabase";

export default function SalaryPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [advances, setAdvances] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);

  const currentMonth = new Date().toISOString().slice(0, 7);
  const [month, setMonth] = useState(currentMonth);

  const formatMoney = (n: number) =>
    Number(n || 0).toLocaleString("vi-VN") + " đ";

  const loadData = async () => {
    const { data: emp } = await supabase.from("employees").select("*");
    const { data: ass } = await supabase
      .from("job_assignments")
      .select("*, jobs(customer_name, event_name, service), job_days(shooting_date,start_time,end_time)");
    const { data: adv } = await supabase.from("salary_advances").select("*");
    const { data: pay } = await supabase.from("salary_payments").select("*");

    setEmployees(emp || []);
    setAssignments(ass || []);
    setAdvances(adv || []);
    setPayments(pay || []);
  };

  useEffect(() => {
    loadData();
  }, []);

  const monthAssignments = assignments.filter((a) =>
    a.job_days?.shooting_date?.startsWith(month)
  );

  const monthAdvances = advances.filter((a) =>
    a.advance_date?.startsWith(month)
  );

  const monthPayments = payments.filter((p) =>
    p.payment_date?.startsWith(month)
  );

  const rows = employees.map((emp) => {
    const empAssignments = monthAssignments.filter(
      (a) => a.employee_id === emp.id
    );
    const totalSalary = empAssignments.reduce(
      (sum, a) => sum + Number(a.salary_amount || 0),
      0
    );

    const totalAdvance = monthAdvances
      .filter((a) => a.employee_id === emp.id)
      .reduce((sum, a) => sum + Number(a.amount || 0), 0);

    const totalPaid = monthPayments
      .filter((p) => p.employee_id === emp.id)
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    return {
      ...emp,
      totalSalary,
      totalAdvance,
      totalPaid,
      remain: totalSalary - totalAdvance - totalPaid,
      jobs: empAssignments,
    };
  });

  const totalSalary = rows.reduce((s, r) => s + r.totalSalary, 0);
  const totalAdvance = rows.reduce((s, r) => s + r.totalAdvance, 0);
  const totalPaid = rows.reduce((s, r) => s + r.totalPaid, 0);
  const totalRemain = rows.reduce((s, r) => s + r.remain, 0);

  const addAdvance = async (employeeId: string) => {
    const amount = Number(prompt("Nhập số tiền ứng:") || 0);
    if (!amount) return;

    const { error } = await supabase.from("salary_advances").insert([
      {
        employee_id: employeeId,
        amount,
        advance_date: new Date().toISOString().slice(0, 10),
        note: "Ứng lương",
      },
    ]);

    if (error) alert(error.message);
    loadData();
  };

  const addPayment = async (employeeId: string) => {
    const amount = Number(prompt("Nhập số tiền thanh toán lương:") || 0);
    if (!amount) return;

    const { error } = await supabase.from("salary_payments").insert([
      {
        employee_id: employeeId,
        amount,
        payment_date: new Date().toISOString().slice(0, 10),
        note: "Thanh toán lương",
      },
    ]);

    if (error) alert(error.message);
    loadData();
  };

  return (
    <MainLayout>
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Lương nhân sự</h1>
          <p className="text-gray-500">
            Xem lương theo job, ứng lương, đã thanh toán và còn phải trả
          </p>
        </div>

        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="border rounded-lg p-3"
        />
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-5 shadow">
          <p className="text-gray-500">Nhân sự</p>
          <p className="text-3xl font-bold">{employees.length}</p>
        </div>

        <div className="bg-white rounded-xl p-5 shadow">
          <p className="text-gray-500">Tổng lương tháng</p>
          <p className="text-3xl font-bold">{formatMoney(totalSalary)}</p>
        </div>

        <div className="bg-white rounded-xl p-5 shadow">
          <p className="text-gray-500">Đã ứng / đã trả</p>
          <p className="text-3xl font-bold text-green-600">
            {formatMoney(totalAdvance + totalPaid)}
          </p>
        </div>

        <div className="bg-white rounded-xl p-5 shadow">
          <p className="text-gray-500">Còn phải trả</p>
          <p className="text-3xl font-bold text-red-600">
            {formatMoney(totalRemain)}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-6">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-left p-3">Nhân sự</th>
              <th className="text-left p-3">Vai trò</th>
              <th className="text-left p-3">Job tháng</th>
              <th className="text-left p-3">Lương phát sinh</th>
              <th className="text-left p-3">Đã ứng</th>
              <th className="text-left p-3">Đã thanh toán</th>
              <th className="text-left p-3">Còn phải trả</th>
              <th className="text-left p-3">Thao tác</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((emp) => (
              <tr key={emp.id} className="border-b">
                <td className="p-3 font-bold">{emp.full_name}</td>
                <td className="p-3">{emp.role}</td>
                <td className="p-3">{emp.jobs.length}</td>
                <td className="p-3">{formatMoney(emp.totalSalary)}</td>
                <td className="p-3 text-orange-600">
                  {formatMoney(emp.totalAdvance)}
                </td>
                <td className="p-3 text-green-600">
                  {formatMoney(emp.totalPaid)}
                </td>
                <td className="p-3 text-red-600 font-bold">
                  {formatMoney(emp.remain)}
                </td>
                <td className="p-3 space-x-2">
                  <button
                    onClick={() => setSelectedEmployee(emp)}
                    className="bg-blue-600 text-white px-3 py-1 rounded"
                  >
                    Xem
                  </button>

                  <button
                    onClick={() => addAdvance(emp.id)}
                    className="bg-yellow-500 text-white px-3 py-1 rounded"
                  >
                    Ứng
                  </button>

                  <button
                    onClick={() => addPayment(emp.id)}
                    className="bg-green-600 text-white px-3 py-1 rounded"
                  >
                    Trả
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedEmployee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-[800px] max-h-[85vh] overflow-auto">
            <h2 className="text-2xl font-bold mb-2">
              Chi tiết lương: {selectedEmployee.full_name}
            </h2>

            <p className="mb-4 text-gray-500">Tháng {month}</p>

            <div className="grid grid-cols-4 gap-3 mb-5">
              <div className="border rounded p-3">
                <p>Lương phát sinh</p>
                <b>{formatMoney(selectedEmployee.totalSalary)}</b>
              </div>
              <div className="border rounded p-3">
                <p>Đã ứng</p>
                <b>{formatMoney(selectedEmployee.totalAdvance)}</b>
              </div>
              <div className="border rounded p-3">
                <p>Đã thanh toán</p>
                <b>{formatMoney(selectedEmployee.totalPaid)}</b>
              </div>
              <div className="border rounded p-3">
                <p>Còn phải trả</p>
                <b className="text-red-600">
                  {formatMoney(selectedEmployee.remain)}
                </b>
              </div>
            </div>

            <h3 className="font-bold mb-3">Danh sách job đã làm</h3>

            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-2">Ngày</th>
                  <th className="text-left p-2">Khách / sự kiện</th>
                  <th className="text-left p-2">Vai trò</th>
                  <th className="text-left p-2">Địa điểm</th>
                  <th className="text-left p-2">Lương</th>
                  <th className="text-left p-2">Ghi chú</th>
                </tr>
              </thead>

              <tbody>
                {selectedEmployee.jobs.map((job: any) => (
                  <tr key={job.id} className="border-b">
                    <td className="p-2">
                      {job.job_days?.shooting_date}
                      <br />
                      <span className="text-gray-500">
                        {job.job_days?.start_time} - {job.job_days?.end_time}
                      </span>
                    </td>
                    <td className="p-2">
                      {job.jobs?.event_name || job.jobs?.customer_name}
                      <br />
                      <span className="text-gray-500">
                        {job.jobs?.service}
                      </span>
                    </td>
                    <td className="p-2">{job.role}</td>
                    <td className="p-2">
                      {job.work_location_name}
                      <br />
                      <span className="text-gray-500">
                        {job.work_location_address}
                      </span>
                    </td>
                    <td className="p-2 font-bold">
                      {formatMoney(job.salary_amount)}
                    </td>
                    <td className="p-2">{job.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setSelectedEmployee(null)}
                className="border px-5 py-2 rounded"
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