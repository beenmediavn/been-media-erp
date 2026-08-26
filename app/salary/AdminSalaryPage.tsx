"use client";

import { useEffect, useMemo, useState } from "react";
import MainLayout from "../components/layout/MainLayout";
import { supabase } from "@/lib/supabase";
import MoneyInput from "../components/MoneyInput";
import { formatDateVN } from "@/lib/date-vn";

type SalaryFilter = "all" | "paid" | "unpaid" | "debt" | "advance";

const FILTERS: { key: SalaryFilter; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "paid", label: "Đã trả đủ" },
  { key: "unpaid", label: "Chưa trả" },
  { key: "debt", label: "Còn nợ lương" },
  { key: "advance", label: "Đã ứng" },
];

export default function AdminSalaryPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [advances, setAdvances] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [filter, setFilter] = useState<SalaryFilter>("all");
  const [search, setSearch] = useState("");
  const [editingTxn, setEditingTxn] = useState<any>(null);

  const currentMonth = new Date().toISOString().slice(0, 7);
  const [month, setMonth] = useState(currentMonth);

  const formatMoney = (n: number) => Number(n || 0).toLocaleString("vi-VN") + " đ";

  const loadData = async () => {
    const { data: emp } = await supabase.from("employees").select("*").order("created_at", { ascending: false });
    const { data: ass } = await supabase
      .from("job_assignments")
      .select("*, jobs(customer_name, event_name, service), job_days(shooting_date,start_time,end_time)");
    const { data: adv } = await supabase.from("salary_advances").select("*").order("advance_date", { ascending: false });
    const { data: pay } = await supabase.from("salary_payments").select("*").order("payment_date", { ascending: false });

    setEmployees(emp || []);
    setAssignments(ass || []);
    setAdvances(adv || []);
    setPayments(pay || []);
  };

  useEffect(() => {
    loadData();
  }, []);

  const monthAssignments = assignments.filter((a) => a.job_days?.shooting_date?.startsWith(month));
  const monthAdvances = advances.filter((a) => a.advance_date?.startsWith(month));
  const monthPayments = payments.filter((p) => p.payment_date?.startsWith(month));

  const rows = useMemo(() => {
    return employees.map((emp) => {
      const empAssignments = monthAssignments.filter((a) => a.employee_id === emp.id);
      const totalSalary = empAssignments.reduce((sum, a) => sum + Number(a.salary_amount || 0), 0);
      const totalAdvance = monthAdvances.filter((a) => a.employee_id === emp.id).reduce((sum, a) => sum + Number(a.amount || 0), 0);
      const totalPaid = monthPayments.filter((p) => p.employee_id === emp.id).reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const remainRaw = totalSalary - totalAdvance - totalPaid;
      const remain = Math.max(remainRaw, 0);
      const overpaid = Math.max(-remainRaw, 0);

      return { ...emp, totalSalary, totalAdvance, totalPaid, remain, remainRaw, overpaid, jobs: empAssignments };
    });
  }, [employees, monthAssignments, monthAdvances, monthPayments]);

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return rows.filter((emp) => {
      const statusMatch =
        filter === "all" ||
        (filter === "paid" && emp.totalSalary > 0 && emp.remain <= 0) ||
        (filter === "unpaid" && emp.totalSalary > 0 && emp.totalPaid <= 0 && emp.totalAdvance <= 0) ||
        (filter === "debt" && emp.remain > 0) ||
        (filter === "advance" && emp.totalAdvance > 0);
      const text = [emp.full_name, emp.phone, emp.role, emp.username].join(" ").toLowerCase();
      return statusMatch && (!keyword || text.includes(keyword));
    });
  }, [rows, filter, search]);

  const totalSalary = rows.reduce((s, r) => s + r.totalSalary, 0);
  const totalAdvance = rows.reduce((s, r) => s + r.totalAdvance, 0);
  const totalPaid = rows.reduce((s, r) => s + r.totalPaid, 0);
  const totalRemain = rows.reduce((s, r) => s + r.remain, 0);
  const debtRows = rows.filter((r) => r.remain > 0).sort((a, b) => b.remain - a.remain);

  const addAdvance = async (employeeId: string) => {
    const amount = Number(prompt("Nhập số tiền ứng:") || 0);
    if (!amount) return;

    const today=new Date().toISOString().slice(0,10);
    const { data:row, error } = await supabase.from("salary_advances").insert([
      { employee_id: employeeId, amount, advance_date: today, note: "Ứng lương" },
    ]).select("id").single();
    if (error) return alert(error.message);
    if(row) await supabase.from("finance_transactions").insert([{transaction_date:today,transaction_type:"expense",amount,category:"Ứng lương",description:"Ứng lương nhân sự",employee_id:employeeId,source_type:"salary_advance",source_id:row.id}]);
    loadData();
  };

  const addPayment = async (employeeId: string, maxAmount?: number) => {
    const amount = Number(prompt("Nhập số tiền thanh toán lương:", String(Math.max(Number(maxAmount || 0), 0))) || 0);
    if (!amount) return;

    const today=new Date().toISOString().slice(0,10);
    const { data:row, error } = await supabase.from("salary_payments").insert([
      { employee_id: employeeId, amount, payment_date: today, note: "Thanh toán lương" },
    ]).select("id").single();
    if (error) return alert(error.message);
    if(row) await supabase.from("finance_transactions").insert([{transaction_date:today,transaction_type:"expense",amount,category:"Lương thợ",description:"Thanh toán lương nhân sự",employee_id:employeeId,source_type:"salary_payment",source_id:row.id}]);
    loadData();
  };

  const openTxnEdit=(type:"advance"|"payment", row:any)=>setEditingTxn({type,...row});
  const saveTxnEdit=async()=>{
    if(!editingTxn) return;
    const table=editingTxn.type==="advance"?"salary_advances":"salary_payments";
    const dateKey=editingTxn.type==="advance"?"advance_date":"payment_date";
    const {error}=await supabase.from(table).update({amount:Number(editingTxn.amount||0),[dateKey]:editingTxn[dateKey],note:editingTxn.note||""}).eq("id",editingTxn.id);
    if(error) return alert(error.message);
    await supabase.from("finance_transactions").update({amount:Number(editingTxn.amount||0),transaction_date:editingTxn[dateKey],description:editingTxn.note|| (editingTxn.type==="advance"?"Ứng lương":"Thanh toán lương")}).eq("source_type",editingTxn.type==="advance"?"salary_advance":"salary_payment").eq("source_id",editingTxn.id);
    setEditingTxn(null);loadData();
  };
  const deleteTxn=async(type:"advance"|"payment",row:any)=>{
    if(!confirm(`Xóa giao dịch ${formatMoney(row.amount)}?`)) return;
    const table=type==="advance"?"salary_advances":"salary_payments";
    const {error}=await supabase.from(table).delete().eq("id",row.id); if(error) return alert(error.message);
    await supabase.from("finance_transactions").delete().eq("source_type",type==="advance"?"salary_advance":"salary_payment").eq("source_id",row.id);loadData();
  };

  return (
    <MainLayout>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Lương nhân sự</h1>
          <p className="text-gray-500">Theo dõi lương phát sinh, ứng lương, đã trả và còn nợ lương</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <input value={search} onChange={(e) => setSearch(e.target.value)} className="rounded-xl border bg-white p-3" placeholder="Tìm nhân sự..." />
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="border rounded-xl p-3 bg-white" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5 mb-5">
        <div className="bg-white rounded-xl p-4 shadow"><p className="text-gray-500">Nhân sự</p><p className="text-2xl font-bold">{employees.length}</p></div>
        <div className="bg-white rounded-xl p-4 shadow"><p className="text-gray-500">Tổng lương</p><p className="text-xl font-bold">{formatMoney(totalSalary)}</p></div>
        <div className="bg-white rounded-xl p-4 shadow"><p className="text-gray-500">Đã ứng</p><p className="text-xl font-bold text-orange-600">{formatMoney(totalAdvance)}</p></div>
        <div className="bg-white rounded-xl p-4 shadow"><p className="text-gray-500">Đã trả</p><p className="text-xl font-bold text-green-600">{formatMoney(totalPaid)}</p></div>
        <div className="bg-white rounded-xl p-4 shadow col-span-2 lg:col-span-1"><p className="text-gray-500">BEEN MEDIA còn phải trả thợ</p><p className="text-xl font-bold text-red-600">{formatMoney(totalRemain)}</p></div>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button key={item.key} onClick={() => setFilter(item.key)} className={`rounded-full px-4 py-2 text-sm font-semibold ${filter === item.key ? "bg-blue-600 text-white" : "bg-white text-slate-700 border"}`}>
            {item.label}
          </button>
        ))}
      </div>

      {debtRows.length > 0 && (
        <div className="mb-6 rounded-2xl bg-red-50 p-4 shadow-sm border border-red-100">
          <h2 className="font-bold text-red-700 mb-3">Danh sách còn nợ lương ({debtRows.length} người)</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {debtRows.slice(0, 9).map((emp) => (
              <div key={emp.id} className="rounded-xl bg-white p-3 border">
                <p className="font-semibold">{emp.full_name}</p>
                <p className="text-sm text-slate-500">{emp.role}</p>
                <p className="mt-2 text-red-600 font-bold">Còn nợ: {formatMoney(emp.remain)}</p>
                <button onClick={() => addPayment(emp.id, emp.remain)} className="mt-2 rounded-lg bg-green-600 px-3 py-1 text-sm text-white">Trả lương</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow p-4 sm:p-6">
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[1000px]">
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
              {filteredRows.map((emp) => (
                <tr key={emp.id} className="border-b">
                  <td className="p-3 font-bold">{emp.full_name}</td>
                  <td className="p-3">{emp.role}</td>
                  <td className="p-3">{emp.jobs.length}</td>
                  <td className="p-3">{formatMoney(emp.totalSalary)}</td>
                  <td className="p-3 text-orange-600">{formatMoney(emp.totalAdvance)}</td>
                  <td className="p-3 text-green-600">{formatMoney(emp.totalPaid)}</td>
                  <td className="p-3 font-bold">{emp.overpaid>0?<span className="text-amber-600">Đã trả dư {formatMoney(emp.overpaid)}</span>:emp.remain>0?<span className="text-red-600">{formatMoney(emp.remain)}</span>:<span className="text-green-600">Đã thanh toán đủ</span>}</td>
                  <td className="p-3 space-x-2">
                    <button onClick={() => setSelectedEmployee(emp)} className="bg-blue-600 text-white px-3 py-1 rounded">Xem</button>
                    <button onClick={() => addAdvance(emp.id)} className="bg-yellow-500 text-white px-3 py-1 rounded">Ứng lương</button>
                    <button onClick={() => addPayment(emp.id, emp.remain)} className="bg-green-600 text-white px-3 py-1 rounded">Thanh toán lương</button>
                  </td>
                </tr>
              ))}
              {filteredRows.length === 0 && <tr><td className="p-4 text-gray-500" colSpan={8}>Không có nhân sự phù hợp bộ lọc.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="space-y-3 lg:hidden">
          {filteredRows.map((emp) => (
            <div key={emp.id} className="rounded-2xl border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold">{emp.full_name}</p>
                  <p className="text-sm text-slate-500">{emp.role} • {emp.jobs.length} job</p>
                </div>
                <p className={`font-bold ${emp.overpaid>0?"text-amber-600":emp.remain>0?"text-red-600":"text-green-600"}`}>{emp.overpaid>0?`Trả dư ${formatMoney(emp.overpaid)}`:emp.remain>0?formatMoney(emp.remain):"Đã đủ"}</p>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <p>Lương: <b>{formatMoney(emp.totalSalary)}</b></p>
                <p>Ứng: <b className="text-orange-600">{formatMoney(emp.totalAdvance)}</b></p>
                <p>Đã trả: <b className="text-green-600">{formatMoney(emp.totalPaid)}</b></p>
                <p>BEEN MEDIA còn trả: <b className="text-red-600">{formatMoney(emp.remain)}</b></p>
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={() => setSelectedEmployee(emp)} className="flex-1 rounded-lg bg-blue-600 p-2 text-white">Xem</button>
                <button onClick={() => addAdvance(emp.id)} className="flex-1 rounded-lg bg-yellow-500 p-2 text-white">Ứng lương</button>
                <button onClick={() => addPayment(emp.id, emp.remain)} className="flex-1 rounded-lg bg-green-600 p-2 text-white">Thanh toán</button>
              </div>
            </div>
          ))}
          {filteredRows.length === 0 && <p className="text-gray-500">Không có nhân sự phù hợp bộ lọc.</p>}
        </div>
      </div>

      {editingTxn&&<div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-6"><h2 className="text-xl font-bold">Sửa {editingTxn.type==="advance"?"khoản ứng":"thanh toán lương"}</h2><div className="mt-4 space-y-3"><label className="block text-sm font-medium">Số tiền<MoneyInput className="mt-1 w-full rounded-xl border p-3" value={editingTxn.amount||0} onChange={v=>setEditingTxn({...editingTxn,amount:v})}/></label><label className="block text-sm font-medium">Ngày<input type="date" className="mt-1 w-full rounded-xl border p-3" value={editingTxn.type==="advance"?editingTxn.advance_date:editingTxn.payment_date} onChange={e=>setEditingTxn({...editingTxn,[editingTxn.type==="advance"?"advance_date":"payment_date"]:e.target.value})}/></label><label className="block text-sm font-medium">Ghi chú<input className="mt-1 w-full rounded-xl border p-3" value={editingTxn.note||""} onChange={e=>setEditingTxn({...editingTxn,note:e.target.value})}/></label></div><div className="mt-5 flex justify-end gap-2"><button onClick={()=>setEditingTxn(null)} className="rounded-xl border px-4 py-2">Hủy</button><button onClick={saveTxnEdit} className="rounded-xl bg-blue-600 px-4 py-2 text-white">Cập nhật</button></div></div></div>}

      {selectedEmployee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-5 sm:p-6 w-full max-w-4xl max-h-[85vh] overflow-auto">
            <h2 className="text-2xl font-bold mb-2">Chi tiết lương: {selectedEmployee.full_name}</h2>
            <p className="mb-4 text-gray-500">Tháng {month}</p>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
              <div className="border rounded p-3"><p>Lương phát sinh</p><b>{formatMoney(selectedEmployee.totalSalary)}</b></div>
              <div className="border rounded p-3"><p>Đã ứng</p><b>{formatMoney(selectedEmployee.totalAdvance)}</b></div>
              <div className="border rounded p-3"><p>Đã thanh toán</p><b>{formatMoney(selectedEmployee.totalPaid)}</b></div>
              <div className="border rounded p-3"><p>BEEN MEDIA còn phải trả</p>{selectedEmployee.overpaid>0?<b className="text-amber-600">Đã trả dư {formatMoney(selectedEmployee.overpaid)}</b>:<b className="text-red-600">{formatMoney(selectedEmployee.remain)}</b>}</div>
            </div>

            <div className="mb-5 grid gap-4 md:grid-cols-2"><div className="rounded-xl border p-3"><h3 className="font-bold">Lịch sử ứng lương</h3><div className="mt-2 space-y-2">{monthAdvances.filter((x:any)=>x.employee_id===selectedEmployee.id).map((x:any)=><div key={x.id} className="rounded-lg bg-amber-50 p-2 text-sm"><div className="flex justify-between"><b>{formatMoney(x.amount)}</b><span>{x.advance_date}</span></div><p className="text-slate-500">{x.note}</p><div className="mt-2 flex gap-2"><button onClick={()=>openTxnEdit("advance",x)} className="rounded bg-amber-500 px-2 py-1 text-white">Sửa</button><button onClick={()=>deleteTxn("advance",x)} className="rounded bg-red-600 px-2 py-1 text-white">Xóa</button></div></div>)}{monthAdvances.filter((x:any)=>x.employee_id===selectedEmployee.id).length===0&&<p className="text-sm text-slate-500">Chưa có khoản ứng.</p>}</div></div><div className="rounded-xl border p-3"><h3 className="font-bold">Lịch sử thanh toán lương</h3><div className="mt-2 space-y-2">{monthPayments.filter((x:any)=>x.employee_id===selectedEmployee.id).map((x:any)=><div key={x.id} className="rounded-lg bg-emerald-50 p-2 text-sm"><div className="flex justify-between"><b>{formatMoney(x.amount)}</b><span>{x.payment_date}</span></div><p className="text-slate-500">{x.note}</p><div className="mt-2 flex gap-2"><button onClick={()=>openTxnEdit("payment",x)} className="rounded bg-amber-500 px-2 py-1 text-white">Sửa</button><button onClick={()=>deleteTxn("payment",x)} className="rounded bg-red-600 px-2 py-1 text-white">Xóa</button></div></div>)}{monthPayments.filter((x:any)=>x.employee_id===selectedEmployee.id).length===0&&<p className="text-sm text-slate-500">Chưa có thanh toán.</p>}</div></div></div>

            <h3 className="font-bold mb-3">Danh sách job đã làm</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead><tr className="border-b bg-gray-50"><th className="text-left p-2">Ngày</th><th className="text-left p-2">Khách / sự kiện</th><th className="text-left p-2">Vai trò</th><th className="text-left p-2">Địa điểm</th><th className="text-left p-2">Lương</th><th className="text-left p-2">Ghi chú</th></tr></thead>
                <tbody>
                  {selectedEmployee.jobs.map((job: any) => (
                    <tr key={job.id} className="border-b">
                      <td className="p-2">{formatDateVN(job.job_days?.shooting_date)}<br /><span className="text-gray-500">{job.job_days?.start_time} - {job.job_days?.end_time}</span></td>
                      <td className="p-2">{job.jobs?.event_name || job.jobs?.customer_name}<br /><span className="text-gray-500">{job.jobs?.service}</span></td>
                      <td className="p-2">{job.role}</td>
                      <td className="p-2">{job.work_location_name}<br /><span className="text-gray-500">{job.work_location_address}</span></td>
                      <td className="p-2 font-bold">{formatMoney(job.salary_amount)}</td>
                      <td className="p-2">{job.note}</td>
                    </tr>
                  ))}
                  {selectedEmployee.jobs.length === 0 && <tr><td className="p-4 text-gray-500" colSpan={6}>Chưa có job trong tháng.</td></tr>}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end mt-6"><button onClick={() => setSelectedEmployee(null)} className="border px-5 py-2 rounded">Đóng</button></div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
