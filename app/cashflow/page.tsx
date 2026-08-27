"use client";

import { useEffect, useMemo, useState } from "react";
import MainLayout from "../components/layout/MainLayout";
import { supabase } from "@/lib/supabase";
import MoneyInput from "../components/MoneyInput";
import { ArrowDownCircle, ArrowUpCircle, Plus, Trash2 } from "lucide-react";
import { requireEditPin } from "@/lib/admin-pin";

const money = (v: any) => Number(v || 0).toLocaleString("vi-VN") + " đ";
const today = () => new Date().toISOString().slice(0, 10);

const expenseCategories = ["Mua đồ / vật tư", "Thiết bị", "Xăng xe", "Ăn uống", "Quảng cáo", "Điện nước", "Phần mềm", "Thuê ngoài", "Sửa chữa", "Khác"];
const incomeCategories = ["Thu khác", "Bán / cho thuê", "Hoàn tiền", "Khác"];

export default function CashflowPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [type, setType] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState(0);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Mua đồ / vật tư");
  const [date, setDate] = useState(today());
  const [method, setMethod] = useState("Chuyển khoản");
  const [saving, setSaving] = useState(false);
  const [month, setMonth] = useState(today().slice(0, 7));

  async function load() {
    const { data, error } = await supabase.from("finance_transactions").select("*").order("transaction_date", { ascending: false }).order("created_at", { ascending: false });
    if (error) { alert(error.message + "\n\nNếu đây là lần đầu dùng Thu/Chi, hãy chạy phần V3 trong SUPABASE_SCHEMA.sql."); return; }
    setRows(data || []);
  }
  useEffect(() => { load(); }, []);

  useEffect(() => {
    setCategory(type === "expense" ? expenseCategories[0] : incomeCategories[0]);
  }, [type]);

  async function save() {
    if (!amount || amount <= 0 || !description.trim()) return alert("Nhập số tiền và nội dung thu/chi.");
    setSaving(true);
    const { error } = await supabase.from("finance_transactions").insert([{ transaction_date: date, transaction_type: type, amount, category, description: description.trim(), payment_method: method }]);
    setSaving(false);
    if (error) return alert(error.message);
    setAmount(0); setDescription(""); await load();
  }

  async function remove(id: string) {
    if(!(await requireEditPin("xóa giao dịch Thu/Chi"))) return;\n    if (!confirm("Xóa giao dịch này?")) return;
    const { error } = await supabase.from("finance_transactions").delete().eq("id", id);
    if (error) return alert(error.message);
    load();
  }

  const filtered = rows.filter(r => String(r.transaction_date || "").startsWith(month));
  const stats = useMemo(() => {
    const income = filtered.filter(r => r.transaction_type === "income").reduce((s, r) => s + Number(r.amount || 0), 0);
    const expense = filtered.filter(r => r.transaction_type === "expense").reduce((s, r) => s + Number(r.amount || 0), 0);
    return { income, expense, balance: income - expense };
  }, [filtered]);

  return <MainLayout>
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><h1 className="text-2xl font-bold sm:text-3xl">Thu / Chi</h1><p className="text-slate-500">Nhập một lần, hệ thống tự đưa vào thống kê tháng và năm.</p></div>
        <input type="month" value={month} onChange={e=>setMonth(e.target.value)} className="rounded-xl border bg-white p-3" />
      </div>

      <div className="mb-5 grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-emerald-50 p-4"><p className="text-xs text-slate-500">Thu khác</p><p className="mt-1 font-bold text-emerald-700">{money(stats.income)}</p></div>
        <div className="rounded-2xl bg-red-50 p-4"><p className="text-xs text-slate-500">Chi</p><p className="mt-1 font-bold text-red-600">{money(stats.expense)}</p></div>
        <div className="rounded-2xl bg-blue-50 p-4"><p className="text-xs text-slate-500">Chênh lệch</p><p className="mt-1 font-bold text-blue-700">{money(stats.balance)}</p></div>
      </div>

      <div className="mb-6 rounded-3xl bg-white p-4 shadow sm:p-6">
        <div className="mb-4 grid grid-cols-2 gap-2">
          <button onClick={()=>setType("income")} className={`rounded-xl p-3 font-bold ${type==="income"?"bg-emerald-600 text-white":"bg-slate-100"}`}><ArrowDownCircle className="mr-2 inline" size={20}/>THU</button>
          <button onClick={()=>setType("expense")} className={`rounded-xl p-3 font-bold ${type==="expense"?"bg-red-600 text-white":"bg-slate-100"}`}><ArrowUpCircle className="mr-2 inline" size={20}/>CHI</button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm font-semibold">Số tiền<MoneyInput value={amount} onChange={setAmount} placeholder="Ví dụ: 1.000.000" className="mt-1 w-full rounded-xl border p-3 text-lg font-bold" /></label>
          <label className="text-sm font-semibold">Ngày<input type="date" value={date} onChange={e=>setDate(e.target.value)} className="mt-1 w-full rounded-xl border p-3" /></label>
          <label className="text-sm font-semibold">Nhóm<select value={category} onChange={e=>setCategory(e.target.value)} className="mt-1 w-full rounded-xl border p-3">{(type==="expense"?expenseCategories:incomeCategories).map(x=><option key={x}>{x}</option>)}</select></label>
          <label className="text-sm font-semibold">Hình thức<select value={method} onChange={e=>setMethod(e.target.value)} className="mt-1 w-full rounded-xl border p-3"><option>Chuyển khoản</option><option>Tiền mặt</option><option>Khác</option></select></label>
          <label className="text-sm font-semibold md:col-span-2">Nội dung<input value={description} onChange={e=>setDescription(e.target.value)} placeholder="Ví dụ: Mua đồ 1 triệu" className="mt-1 w-full rounded-xl border p-3" /></label>
        </div>
        <button disabled={saving} onClick={save} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 p-3 font-bold text-white"><Plus size={20}/>{saving?"Đang lưu...":"Lưu giao dịch"}</button>
      </div>

      <div className="rounded-3xl bg-white p-4 shadow sm:p-6"><h2 className="mb-4 text-lg font-bold">Lịch sử tháng {month.split("-")[1]}/{month.split("-")[0]}</h2>
        <div className="space-y-3">{filtered.map(r=><div key={r.id} className="flex items-center justify-between gap-3 rounded-2xl border p-3"><div className="min-w-0"><p className="truncate font-semibold">{r.description}</p><p className="text-xs text-slate-500">{r.transaction_date} • {r.category} • {r.payment_method}</p></div><div className="flex shrink-0 items-center gap-2"><p className={`font-bold ${r.transaction_type==="income"?"text-emerald-700":"text-red-600"}`}>{r.transaction_type==="income"?"+":"-"}{money(r.amount)}</p><button onClick={()=>remove(r.id)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={17}/></button></div></div>)}{filtered.length===0&&<p className="py-6 text-center text-slate-500">Tháng này chưa có giao dịch.</p>}</div>
      </div>
    </div>
  </MainLayout>;
}
