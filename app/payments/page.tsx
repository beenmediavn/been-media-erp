"use client";

import { useEffect, useMemo, useState } from "react";
import MainLayout from "../components/layout/MainLayout";
import { supabase } from "@/lib/supabase";
import MoneyInput from "../components/MoneyInput";
import { requireEditPin } from "@/lib/admin-pin";

const money = (value: number | string | null | undefined) =>
  Number(value || 0).toLocaleString("vi-VN") + " đ";

type PaymentFilter = "all" | "paid" | "deposit" | "unpaid" | "debt";

const FILTERS: { key: PaymentFilter; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "paid", label: "Đã thanh toán" },
  { key: "deposit", label: "Đã cọc" },
  { key: "unpaid", label: "Chưa TT" },
  { key: "debt", label: "Còn nợ" },
];

function paymentStatus(job: any): PaymentFilter {
  const total = Number(job.total_price || 0);
  const paid = Number(job.deposit || 0);
  const debt = Math.max(Number(job.debt ?? total - paid), 0);
  if (total > 0 && debt <= 0) return "paid";
  if (paid <= 0) return "unpaid";
  if (paid > 0 && debt > 0) return "deposit";
  return "debt";
}

export default function PaymentsPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState("");
  const [filter, setFilter] = useState<PaymentFilter>("all");
  const [search, setSearch] = useState("");
  const [editingPayment, setEditingPayment] = useState<any>(null);

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

  async function recalcJob(jobId: string, customerId?: string) {
    const [{data:job},{data:rows}] = await Promise.all([
      supabase.from("jobs").select("id,total_price,status,customer_id").eq("id",jobId).single(),
      supabase.from("customer_payments").select("amount").eq("job_id",jobId)
    ]);
    if(!job) return;
    const paid=(rows||[]).reduce((s:any,r:any)=>s+Number(r.amount||0),0);
    const debt=Math.max(Number(job.total_price||0)-paid,0);
    // Thanh toán đủ KHÔNG đồng nghĩa Job đã hoàn thành. Trạng thái công việc phải do quy trình Job quyết định.
    await supabase.from("jobs").update({deposit:paid,debt}).eq("id",jobId);
    if(customerId||job.customer_id) await supabase.from("customers").update({deposit:paid,debt}).eq("id",customerId||job.customer_id);
  }

  async function updatePayment(){
    if(!editingPayment || Number(editingPayment.amount||0)<=0) return;
    const {error}=await supabase.from("customer_payments").update({amount:Number(editingPayment.amount),payment_date:editingPayment.payment_date,payment_type:editingPayment.payment_type,method:editingPayment.method||editingPayment.payment_type,note:editingPayment.note||""}).eq("id",editingPayment.id);
    if(error) return alert(error.message);
    await supabase.from("finance_transactions").update({amount:Number(editingPayment.amount),transaction_date:editingPayment.payment_date,description:`Thu khách - ${editingPayment.payment_type||"Thanh toán"}`}).eq("source_type","customer_payment").eq("source_id",editingPayment.id);
    if(editingPayment.job_id) await recalcJob(editingPayment.job_id,editingPayment.customer_id);
    setEditingPayment(null); loadData();
  }

  async function deletePayment(payment:any){
    if(!(await requireEditPin("xóa khoản thu"))) return;
    if(!confirm(`Xóa khoản thu ${money(payment.amount)}? Số công nợ sẽ được tính lại.`)) return;
    const {error}=await supabase.from("customer_payments").delete().eq("id",payment.id); if(error) return alert(error.message);
    await supabase.from("finance_transactions").delete().eq("source_type","customer_payment").eq("source_id",payment.id);
    if(payment.job_id) await recalcJob(payment.job_id,payment.customer_id);
    loadData();
  }

  async function addPayment() {
    if (!selectedJob || amount <= 0) return;

    const newDeposit = Number(selectedJob.deposit || 0) + Number(amount || 0);
    const newDebt = Math.max(Number(selectedJob.total_price || 0) - newDeposit, 0);

    const { data:createdPayment, error: paymentError } = await supabase.from("customer_payments").insert([
      { customer_id: selectedJob.customer_id, job_id: selectedJob.id, amount, payment_type: "Thanh toán thêm", method: "Thanh toán thêm", note },
    ]).select("id,payment_date").single();
    if (paymentError) return alert(paymentError.message);
    if(createdPayment){ await supabase.from("finance_transactions").insert([{transaction_date:createdPayment.payment_date,transaction_type:"income",amount,category:"Thu khách",description:`Thu khách - ${selectedJob.event_name||selectedJob.customer_name||"Job"}`,job_id:selectedJob.id,customer_id:selectedJob.customer_id,source_type:"customer_payment",source_id:createdPayment.id}]); }
    await recalcJob(selectedJob.id,selectedJob.customer_id);

    setSelectedJob(null);
    setAmount(0);
    setNote("");
    loadData();
  }

  const stats = useMemo(() => {
    const total = jobs.reduce((sum, item) => sum + Number(item.total_price || 0), 0);
    const paid = jobs.reduce((sum, item) => sum + Number(item.deposit || 0), 0);
    const debt = jobs.reduce((sum, item) => sum + Math.max(Number(item.debt || 0), 0), 0);
    const paidCount = jobs.filter((job) => paymentStatus(job) === "paid").length;
    const depositCount = jobs.filter((job) => paymentStatus(job) === "deposit").length;
    const unpaidCount = jobs.filter((job) => paymentStatus(job) === "unpaid").length;
    return { total, paid, debt, paidCount, depositCount, unpaidCount };
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return jobs.filter((job) => {
      const status = paymentStatus(job);
      const matchFilter = filter === "all" || (filter === "debt" ? Number(job.debt || 0) > 0 : status === filter);
      const text = [job.customers?.full_name, job.customers?.phone, job.customer_name, job.customer_phone, job.service, job.event_name, job.job_code]
        .join(" ")
        .toLowerCase();
      return matchFilter && (!keyword || text.includes(keyword));
    });
  }, [jobs, filter, search]);

  return (
    <MainLayout>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Thanh toán / Công nợ khách</h1>
          <p className="text-gray-500 mt-1">Lọc khách đã thanh toán, đã cọc, chưa thanh toán và còn nợ</p>
        </div>
        <input value={search} onChange={(e) => setSearch(e.target.value)} className="w-full sm:w-96 rounded-xl border bg-white p-3" placeholder="Tìm tên khách, SĐT, mã job..." />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6 mb-6">
        <div className="bg-white rounded-xl p-4 shadow"><p className="text-gray-500">Tổng giá trị</p><p className="text-xl font-bold mt-2">{money(stats.total)}</p></div>
        <div className="bg-white rounded-xl p-4 shadow"><p className="text-gray-500">Đã thu</p><p className="text-xl font-bold mt-2 text-green-700">{money(stats.paid)}</p></div>
        <div className="bg-white rounded-xl p-4 shadow"><p className="text-gray-500">Còn nợ</p><p className="text-xl font-bold mt-2 text-red-600">{money(stats.debt)}</p></div>
        <div className="bg-white rounded-xl p-4 shadow"><p className="text-gray-500">Đã thanh toán</p><p className="text-xl font-bold mt-2">{stats.paidCount}</p></div>
        <div className="bg-white rounded-xl p-4 shadow"><p className="text-gray-500">Đã cọc</p><p className="text-xl font-bold mt-2">{stats.depositCount}</p></div>
        <div className="bg-white rounded-xl p-4 shadow"><p className="text-gray-500">Chưa TT</p><p className="text-xl font-bold mt-2">{stats.unpaidCount}</p></div>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button key={item.key} onClick={() => setFilter(item.key)} className={`rounded-full px-4 py-2 text-sm font-semibold ${filter === item.key ? "bg-blue-600 text-white" : "bg-white text-slate-700 border"}`}>
            {item.label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="bg-white rounded-xl shadow p-4 sm:p-6 xl:col-span-2">
          <h2 className="text-xl font-bold mb-4">Danh sách thanh toán</h2>
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[900px]">
              <thead><tr className="border-b bg-slate-50"><th className="text-left p-3">Khách hàng</th><th className="text-left p-3">Job</th><th className="text-left p-3">Tổng tiền</th><th className="text-left p-3">Đã thu</th><th className="text-left p-3">Còn nợ</th><th className="text-left p-3">Trạng thái</th><th className="text-left p-3">Thao tác</th></tr></thead>
              <tbody>
                {filteredJobs.map((job) => (
                  <tr key={job.id} className="border-b hover:bg-slate-50">
                    <td className="p-3"><div className="font-semibold">{job.customers?.full_name || job.customer_name}</div><div className="text-xs text-gray-500">{job.customers?.phone || job.customer_phone}</div></td>
                    <td className="p-3">{job.service}</td>
                    <td className="p-3">{money(job.total_price)}</td>
                    <td className="p-3 text-green-700">{money(job.deposit)}</td>
                    <td className="p-3 text-red-600 font-semibold">{money(job.debt)}</td>
                    <td className="p-3"><StatusBadge status={paymentStatus(job)} /></td>
                    <td className="p-3"><button onClick={() => setSelectedJob(job)} className="bg-blue-600 text-white px-3 py-1 rounded">Thu thêm</button></td>
                  </tr>
                ))}
                {filteredJobs.length === 0 && <tr><td className="p-4 text-gray-500" colSpan={7}>Không có khách phù hợp bộ lọc.</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 lg:hidden">
            {filteredJobs.map((job) => (
              <div key={job.id} className="rounded-2xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">{job.customers?.full_name || job.customer_name}</p>
                    <p className="text-sm text-slate-500">{job.customers?.phone || job.customer_phone}</p>
                  </div>
                  <StatusBadge status={paymentStatus(job)} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <p>Tổng: <b>{money(job.total_price)}</b></p>
                  <p>Đã thu: <b className="text-green-700">{money(job.deposit)}</b></p>
                  <p className="col-span-2">Còn nợ: <b className="text-red-600">{money(job.debt)}</b></p>
                </div>
                <button onClick={() => setSelectedJob(job)} className="mt-3 w-full rounded-xl bg-blue-600 p-2 text-white">Thu thêm</button>
              </div>
            ))}
            {filteredJobs.length === 0 && <p className="text-gray-500">Không có khách phù hợp bộ lọc.</p>}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-4 sm:p-6">
          <h2 className="text-xl font-bold mb-4">Lịch sử thu tiền</h2>
          <div className="space-y-3 max-h-[520px] overflow-y-auto">
            {payments.map((payment) => (
              <div key={payment.id} className="border rounded-xl p-3">
                <p className="font-semibold">{payment.customers?.full_name}</p>
                <p className="text-green-700 font-bold">{money(payment.amount)}</p>
                <p className="text-sm text-gray-500">{payment.payment_date} • {payment.payment_type}</p>
                {payment.note && <p className="text-sm text-gray-500">{payment.note}</p>}
                <div className="mt-2 flex gap-2"><button onClick={()=>setEditingPayment({...payment})} className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-semibold text-white">Sửa</button><button onClick={()=>deletePayment(payment)} className="rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white">Xóa</button></div>
              </div>
            ))}
            {payments.length === 0 && <p className="text-gray-500">Chưa có lịch sử thanh toán.</p>}
          </div>
        </div>
      </div>

      {editingPayment && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"><div className="w-full max-w-lg rounded-2xl bg-white p-6"><h2 className="text-xl font-bold">Sửa giao dịch thu tiền</h2><p className="mb-4 text-sm text-slate-500">Sửa nhầm tiền/ngày/ghi chú. Hệ thống tự tính lại công nợ.</p><div className="space-y-3"><label className="block text-sm font-medium">Số tiền<MoneyInput value={editingPayment.amount||0} onChange={v=>setEditingPayment({...editingPayment,amount:v})} className="mt-1 w-full rounded-xl border p-3"/></label><label className="block text-sm font-medium">Ngày thu<input type="date" value={editingPayment.payment_date||""} onChange={e=>setEditingPayment({...editingPayment,payment_date:e.target.value})} className="mt-1 w-full rounded-xl border p-3"/></label><label className="block text-sm font-medium">Loại / hình thức<input value={editingPayment.payment_type||editingPayment.method||""} onChange={e=>setEditingPayment({...editingPayment,payment_type:e.target.value,method:e.target.value})} className="mt-1 w-full rounded-xl border p-3"/></label><label className="block text-sm font-medium">Ghi chú<textarea value={editingPayment.note||""} onChange={e=>setEditingPayment({...editingPayment,note:e.target.value})} className="mt-1 w-full rounded-xl border p-3"/></label></div><div className="mt-5 flex justify-end gap-2"><button onClick={()=>setEditingPayment(null)} className="rounded-xl border px-4 py-2">Hủy</button><button onClick={updatePayment} className="rounded-xl bg-blue-600 px-4 py-2 text-white">Cập nhật</button></div></div></div>}

      {selectedJob && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl">
            <h2 className="text-2xl font-bold mb-4">Thu thêm tiền khách</h2>
            <p className="mb-3"><b>Khách:</b> {selectedJob.customers?.full_name || selectedJob.customer_name}</p>
            <p className="mb-3"><b>Còn nợ:</b> <span className="text-red-600">{money(selectedJob.debt)}</span></p>
            <label className="mb-3 block text-sm font-medium">Số tiền thu thêm<MoneyInput className="mt-1 border p-3 rounded-lg w-full" placeholder="Ví dụ: 1.000.000" value={amount} onChange={setAmount} /></label>
            <label className="mb-3 block text-sm font-medium">Ghi chú khoản thu<textarea className="mt-1 border p-3 rounded-lg w-full" placeholder="Ví dụ: Thanh toán đợt 2" value={note} onChange={(e) => setNote(e.target.value)} /></label>
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

function StatusBadge({ status }: { status: PaymentFilter }) {
  const map: Record<PaymentFilter, string> = {
    all: "Tất cả",
    paid: "Đã thanh toán",
    deposit: "Đã cọc",
    unpaid: "Chưa TT",
    debt: "Còn nợ",
  };
  const cls: Record<PaymentFilter, string> = {
    all: "bg-slate-100 text-slate-700",
    paid: "bg-green-100 text-green-700",
    deposit: "bg-yellow-100 text-yellow-700",
    unpaid: "bg-red-100 text-red-700",
    debt: "bg-orange-100 text-orange-700",
  };
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${cls[status]}`}>{map[status]}</span>;
}
