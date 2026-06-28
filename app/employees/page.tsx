"use client";

import { useEffect, useMemo, useState } from "react";
import MainLayout from "../components/layout/MainLayout";
import { supabase } from "@/lib/supabase";

const money = (value: number | string | null | undefined) =>
  Number(value || 0).toLocaleString("vi-VN") + " đ";

const emptyForm = {
  full_name: "",
  phone: "",
  role: "Thợ chụp",
  username: "",
  password: "123456",
  base_fee: 0,
  active: true,
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [advances, setAdvances] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [selected, setSelected] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);

  const monthKey = new Date().toISOString().slice(0, 7);

  async function loadData() {
    const [{ data: emp }, { data: ass }, { data: adv }, { data: pay }] = await Promise.all([
      supabase.from("employees").select("*").order("created_at", { ascending: false }),
      supabase
        .from("job_assignments")
        .select("*, employees(*), jobs(*, customers(*)), job_days(*)")
        .order("created_at", { ascending: false }),
      supabase.from("salary_advances").select("*, employees(*)").order("advance_date", { ascending: false }),
      supabase.from("salary_payments").select("*, employees(*)").order("payment_date", { ascending: false }),
    ]);

    setEmployees(emp || []);
    setAssignments(ass || []);
    setAdvances(adv || []);
    setPayments(pay || []);
  }

  useEffect(() => {
    loadData();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpenForm(true);
  };

  const openEdit = (employee: any) => {
    setEditing(employee);
    setForm({
      full_name: employee.full_name || "",
      phone: employee.phone || "",
      role: employee.role || "Thợ chụp",
      username: employee.username || "",
      password: employee.password || "123456",
      base_fee: Number(employee.base_fee || 0),
      active: employee.active ?? true,
    });
    setOpenForm(true);
  };

  async function saveEmployee() {
    if (!form.full_name.trim()) {
      alert("Vui lòng nhập tên nhân sự");
      return;
    }

    const payload = { ...form, base_fee: Number(form.base_fee || 0) };
    const request = editing
      ? supabase.from("employees").update(payload).eq("id", editing.id)
      : supabase.from("employees").insert([payload]);

    const { error } = await request;
    if (error) {
      alert(error.message);
      return;
    }

    setOpenForm(false);
    setEditing(null);
    setForm(emptyForm);
    loadData();
  }

  async function deleteEmployee(id: string) {
    if (!confirm("Bạn chắc chắn muốn xóa nhân sự này?")) return;
    const { error } = await supabase.from("employees").delete().eq("id", id);
    if (error) alert(error.message);
    loadData();
  }

  const employeeSummary = useMemo(() => {
    return employees.map((employee) => {
      const empAssignments = assignments.filter((a) => a.employee_id === employee.id);
      const monthAssignments = empAssignments.filter((a) =>
        String(a.job_days?.shooting_date || a.created_at || "").startsWith(monthKey)
      );
      const monthAdvances = advances.filter(
        (a) => a.employee_id === employee.id && String(a.advance_date || "").startsWith(monthKey)
      );
      const monthPayments = payments.filter(
        (p) => p.employee_id === employee.id && String(p.payment_date || "").startsWith(monthKey)
      );
      const salary = monthAssignments.reduce((sum, a) => sum + Number(a.salary_amount || 0), 0);
      const advance = monthAdvances.reduce((sum, a) => sum + Number(a.amount || 0), 0);
      const paid = monthPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

      return { employee, salary, advance, paid, remaining: salary - advance - paid, count: monthAssignments.length };
    });
  }, [employees, assignments, advances, payments, monthKey]);

  return (
    <MainLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Nhân sự</h1>
          <p className="text-gray-500 mt-1">Danh sách thợ, tài khoản đăng nhập và lương theo job</p>
        </div>
        <button onClick={openCreate} className="bg-blue-600 text-white px-5 py-3 rounded-lg">
          + Thêm nhân sự
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-5 shadow">
          <p className="text-gray-500">Tổng nhân sự</p>
          <p className="text-3xl font-bold mt-2">{employees.length}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow">
          <p className="text-gray-500">Lương phát sinh tháng</p>
          <p className="text-2xl font-bold mt-2">
            {money(employeeSummary.reduce((s, x) => s + x.salary, 0))}
          </p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow">
          <p className="text-gray-500">Đã ứng</p>
          <p className="text-2xl font-bold mt-2 text-orange-600">
            {money(employeeSummary.reduce((s, x) => s + x.advance, 0))}
          </p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow">
          <p className="text-gray-500">Còn phải trả</p>
          <p className="text-2xl font-bold mt-2 text-red-600">
            {money(employeeSummary.reduce((s, x) => s + x.remaining, 0))}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-6 overflow-x-auto">
        <table className="w-full min-w-[1000px]">
          <thead>
            <tr className="border-b bg-slate-50">
              <th className="text-left p-3">Nhân sự</th>
              <th className="text-left p-3">Vai trò</th>
              <th className="text-left p-3">User</th>
              <th className="text-left p-3">Job tháng</th>
              <th className="text-left p-3">Lương phát sinh</th>
              <th className="text-left p-3">Đã ứng</th>
              <th className="text-left p-3">Đã thanh toán</th>
              <th className="text-left p-3">Còn phải trả</th>
              <th className="text-left p-3">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {employeeSummary.map((row) => (
              <tr key={row.employee.id} className="border-b hover:bg-slate-50">
                <td className="p-3">
                  <button onClick={() => setSelected(row.employee)} className="font-semibold text-blue-700 hover:underline">
                    {row.employee.full_name}
                  </button>
                  <div className="text-xs text-gray-500">{row.employee.phone}</div>
                </td>
                <td className="p-3">{row.employee.role}</td>
                <td className="p-3">{row.employee.username || "Chưa có"}</td>
                <td className="p-3">{row.count}</td>
                <td className="p-3">{money(row.salary)}</td>
                <td className="p-3 text-orange-600">{money(row.advance)}</td>
                <td className="p-3 text-green-700">{money(row.paid)}</td>
                <td className="p-3 text-red-600 font-semibold">{money(row.remaining)}</td>
                <td className="p-3 whitespace-nowrap">
                  <button onClick={() => openEdit(row.employee)} className="bg-yellow-500 text-white px-3 py-1 rounded mr-2">
                    Sửa
                  </button>
                  <button onClick={() => deleteEmployee(row.employee.id)} className="bg-red-600 text-white px-3 py-1 rounded">
                    Xóa
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {openForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl p-6 shadow-xl">
            <h2 className="text-2xl font-bold mb-4">{editing ? "Sửa nhân sự" : "Thêm nhân sự"}</h2>
            <div className="space-y-3">
              <input className="border p-3 rounded-lg w-full" placeholder="Họ tên nhân sự" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
              <input className="border p-3 rounded-lg w-full" placeholder="SĐT" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <select className="border p-3 rounded-lg w-full" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option>Thợ chụp</option>
                <option>Thợ quay</option>
                <option>Flycam</option>
                <option>Editor</option>
                <option>Livestream</option>
                <option>Sale</option>
                <option>Kế toán</option>
              </select>
              <div className="grid grid-cols-2 gap-3">
                <input className="border p-3 rounded-lg" placeholder="Username đăng nhập" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
                <input className="border p-3 rounded-lg" placeholder="Mật khẩu" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
              <input type="number" className="border p-3 rounded-lg w-full" placeholder="Lương mặc định / ca" value={form.base_fee} onChange={(e) => setForm({ ...form, base_fee: Number(e.target.value) })} />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setOpenForm(false)} className="border px-4 py-2 rounded-lg">Hủy</button>
              <button onClick={saveEmployee} className="bg-blue-600 text-white px-4 py-2 rounded-lg">Lưu</button>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <EmployeeDetail
          employee={selected}
          assignments={assignments.filter((a) => a.employee_id === selected.id)}
          advances={advances.filter((a) => a.employee_id === selected.id)}
          payments={payments.filter((p) => p.employee_id === selected.id)}
          onClose={() => setSelected(null)}
          onChanged={loadData}
        />
      )}
    </MainLayout>
  );
}

function EmployeeDetail({ employee, assignments, advances, payments, onClose, onChanged }: any) {
  const [advanceAmount, setAdvanceAmount] = useState(0);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const monthKey = new Date().toISOString().slice(0, 7);
  const monthAssignments = assignments.filter((a: any) => String(a.job_days?.shooting_date || a.created_at || "").startsWith(monthKey));
  const monthAdvances = advances.filter((a: any) => String(a.advance_date || "").startsWith(monthKey));
  const monthPayments = payments.filter((p: any) => String(p.payment_date || "").startsWith(monthKey));
  const salary = monthAssignments.reduce((s: number, a: any) => s + Number(a.salary_amount || 0), 0);
  const advance = monthAdvances.reduce((s: number, a: any) => s + Number(a.amount || 0), 0);
  const paid = monthPayments.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);

  async function addAdvance() {
    if (!advanceAmount) return;
    const { error } = await supabase.from("salary_advances").insert([{ employee_id: employee.id, amount: advanceAmount, note: "Ứng lương" }]);
    if (error) return alert(error.message);
    setAdvanceAmount(0);
    onChanged();
  }

  async function addPayment() {
    if (!paymentAmount) return;
    const { error } = await supabase.from("salary_payments").insert([{ employee_id: employee.id, amount: paymentAmount, note: "Thanh toán lương" }]);
    if (error) return alert(error.message);
    setPaymentAmount(0);
    onChanged();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-5">
          <div>
            <h2 className="text-2xl font-bold">{employee.full_name}</h2>
            <p className="text-gray-500">{employee.role} • Tháng {monthKey}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-red-600">✕</button>
        </div>

        <div className="grid grid-cols-4 gap-3 mb-5">
          <div className="border rounded-xl p-4"><p className="text-gray-500">Lương phát sinh</p><p className="text-xl font-bold">{money(salary)}</p></div>
          <div className="border rounded-xl p-4"><p className="text-gray-500">Đã ứng</p><p className="text-xl font-bold text-orange-600">{money(advance)}</p></div>
          <div className="border rounded-xl p-4"><p className="text-gray-500">Đã thanh toán</p><p className="text-xl font-bold text-green-700">{money(paid)}</p></div>
          <div className="border rounded-xl p-4"><p className="text-gray-500">Còn phải trả</p><p className="text-xl font-bold text-red-600">{money(salary - advance - paid)}</p></div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="border rounded-xl p-4">
            <p className="font-bold mb-2">+ Ứng lương</p>
            <div className="flex gap-2"><input type="number" value={advanceAmount} onChange={(e) => setAdvanceAmount(Number(e.target.value))} className="border p-2 rounded flex-1" /><button onClick={addAdvance} className="bg-orange-500 text-white px-4 rounded">Lưu</button></div>
          </div>
          <div className="border rounded-xl p-4">
            <p className="font-bold mb-2">+ Thanh toán lương</p>
            <div className="flex gap-2"><input type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(Number(e.target.value))} className="border p-2 rounded flex-1" /><button onClick={addPayment} className="bg-green-600 text-white px-4 rounded">Lưu</button></div>
          </div>
        </div>

        <h3 className="font-bold mb-2">Job đã làm trong tháng</h3>
        <div className="border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50"><tr><th className="text-left p-3">Ngày</th><th className="text-left p-3">Khách</th><th className="text-left p-3">Vai trò</th><th className="text-left p-3">Lương</th></tr></thead>
            <tbody>
              {monthAssignments.map((a: any) => (
                <tr key={a.id} className="border-t">
                  <td className="p-3">{a.job_days?.shooting_date} {a.job_days?.start_time}</td>
                  <td className="p-3">{a.jobs?.customers?.full_name || a.jobs?.service}</td>
                  <td className="p-3">{a.role}</td>
                  <td className="p-3">{money(a.salary_amount)}</td>
                </tr>
              ))}
              {monthAssignments.length === 0 && <tr><td className="p-3 text-gray-500" colSpan={4}>Chưa có job trong tháng.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
