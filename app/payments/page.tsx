"use client";

import { useEffect, useState } from "react";
import MainLayout from "../components/layout/MainLayout";
import { supabase } from "@/lib/supabase";

const money = (value: number | string | null | undefined) =>
  Number(value || 0).toLocaleString("vi-VN") + " đ";

export default function PaymentsPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState("");

  async function loadData() {
    const [{ data: jobData, error }, { data: paymentData }] = await Promise.all([
      supabase.from("jobs").select("*, customers(*)").order("created_at", { ascending: false }),
      supabase.from("customer_payments").select("*, customers(*), jobs(*)").order("payment_date", { ascending: false }),
    ]);

    if (error) {
      alert(error.message);
      return;
    }

    setJobs(jobData || []);
    setPayments(paymentData || []);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function addPayment() {
    if (!selectedJob || amount <= 0) return;

    const newDeposit = Number(selectedJob.deposit || 0) + Number(amount || 0);
    const newDebt = Number(selectedJob.total_price || 0) - newDeposit;

    const { error: paymentError } = await supabase.from("customer_payments").insert([
      {
        customer_id: selectedJob.customer_id,
        job_id: selectedJob.id,
        amount,
        payment_type: "Thanh toán thêm",
        note,
      },
    ]);

    if (paymentError) return alert(paymentError.message);

    const { error: jobError } = await supabase
      .from("jobs")
      .update({ deposit: newDeposit, debt: newDebt, status: newDebt <= 0 ? "Hoàn thành" : selectedJob.status })
      .eq("id", selectedJob.id);

    if (jobError) return alert(jobError.message);

    if (selectedJob.customer_id) {
      await supabase
        .from("customers")
        .update({ deposit: newDeposit, debt: newDebt, status: newDebt <= 0 ? "Hoàn thành" : selectedJob.status })
        .eq("id", selectedJob.customer_id);
    }

    setSelectedJob(null);
    setAmount(0);
    setNote("");
    loadData();
  }

  const total = jobs.reduce((sum, item) => sum + Number(item.total_price || 0), 0);
  const paid = jobs.reduce((sum, item) => sum + Number(item.deposit || 0), 0);
  const debt = jobs.reduce((sum, item) => sum + Number(item.debt || 0), 0);

  return (
    <MainLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Thanh toán / Công nợ khách</h1>
        <p className="text-gray-500 mt-1">Xem khách nào chưa thanh toán và ghi nhận tiền thu thêm</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl p-5 shadow"><p className="text-gray-500">Tổng giá trị</p><p className="text-3xl font-bold mt-2">{money(total)}</p></div>
        <div className="bg-white rounded-xl p-5 shadow"><p className="text-gray-500">Đã thu</p><p className="text-3xl font-bold mt-2 text-green-700">{money(paid)}</p></div>
        <div className="bg-white rounded-xl p-5 shadow"><p className="text-gray-500">Còn nợ</p><p className="text-3xl font-bold mt-2 text-red-600">{money(debt)}</p></div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow p-6 col-span-2 overflow-x-auto">
          <h2 className="text-xl font-bold mb-4">Danh sách công nợ</h2>
          <table className="w-full min-w-[900px]">
            <thead><tr className="border-b bg-slate-50"><th className="text-left p-3">Khách hàng</th><th className="text-left p-3">Job</th><th className="text-left p-3">Tổng tiền</th><th className="text-left p-3">Đã thu</th><th className="text-left p-3">Còn nợ</th><th className="text-left p-3">Thao tác</th></tr></thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className="border-b hover:bg-slate-50">
                  <td className="p-3"><div className="font-semibold">{job.customers?.full_name}</div><div className="text-xs text-gray-500">{job.customers?.phone}</div></td>
                  <td className="p-3">{job.service}</td>
                  <td className="p-3">{money(job.total_price)}</td>
                  <td className="p-3 text-green-700">{money(job.deposit)}</td>
                  <td className="p-3 text-red-600 font-semibold">{money(job.debt)}</td>
                  <td className="p-3"><button onClick={() => setSelectedJob(job)} className="bg-blue-600 text-white px-3 py-1 rounded">Thu thêm</button></td>
                </tr>
              ))}
              {jobs.length === 0 && <tr><td className="p-4 text-gray-500" colSpan={6}>Chưa có job.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-xl font-bold mb-4">Lịch sử thu tiền</h2>
          <div className="space-y-3 max-h-[520px] overflow-y-auto">
            {payments.map((payment) => (
              <div key={payment.id} className="border rounded-xl p-3">
                <p className="font-semibold">{payment.customers?.full_name}</p>
                <p className="text-green-700 font-bold">{money(payment.amount)}</p>
                <p className="text-sm text-gray-500">{payment.payment_date} • {payment.payment_type}</p>
                {payment.note && <p className="text-sm text-gray-500">{payment.note}</p>}
              </div>
            ))}
            {payments.length === 0 && <p className="text-gray-500">Chưa có lịch sử thanh toán.</p>}
          </div>
        </div>
      </div>

      {selectedJob && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl">
            <h2 className="text-2xl font-bold mb-4">Thu thêm tiền khách</h2>
            <p className="mb-3"><b>Khách:</b> {selectedJob.customers?.full_name}</p>
            <p className="mb-3"><b>Còn nợ:</b> <span className="text-red-600">{money(selectedJob.debt)}</span></p>
            <input type="number" className="border p-3 rounded-lg w-full mb-3" placeholder="Số tiền thu thêm" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
            <textarea className="border p-3 rounded-lg w-full mb-3" placeholder="Ghi chú" value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="flex justify-end gap-3">
              <button onClick={() => setSelectedJob(null)} className="border px-4 py-2 rounded-lg">Hủy</button>
              <button onClick={addPayment} className="bg-blue-600 text-white px-4 py-2 rounded-lg">Lưu thu tiền</button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
