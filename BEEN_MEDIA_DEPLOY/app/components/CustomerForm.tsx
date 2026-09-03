"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import MoneyInput from "./MoneyInput";

interface Props {
  onClose: () => void;
  onSaved: () => void;
  editingCustomer?: any;
}

const emptyForm = {
  full_name: "",
  phone: "",
  email: "",
  address: "",
  facebook: "",
  service: "",
  total_price: 0,
  deposit: 0,
  debt: 0,
  note: "",
  status: "Đang xử lý",
};

export default function CustomerForm({ onClose, onSaved, editingCustomer }: Props) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (editingCustomer) {
      setForm({
        full_name: editingCustomer.full_name || "",
        phone: editingCustomer.phone || "",
        email: editingCustomer.email || "",
        address: editingCustomer.address || "",
        facebook: editingCustomer.facebook || "",
        service: editingCustomer.service || "",
        total_price: Number(editingCustomer.total_price || 0),
        deposit: Number(editingCustomer.deposit || 0),
        debt: Number(editingCustomer.debt || 0),
        note: editingCustomer.note || "",
        status: editingCustomer.status || "Đang xử lý",
      });
    } else {
      setForm(emptyForm);
    }
  }, [editingCustomer]);

  const updateField = (key: keyof typeof emptyForm, value: string | number) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  async function saveCustomer() {
    if (!form.full_name.trim()) {
      alert("Vui lòng nhập họ tên khách hàng");
      return;
    }

    setLoading(true);

    const payload = {
      ...form,
      total_price: Number(form.total_price || 0),
      deposit: Number(form.deposit || 0),
      debt: Number(form.total_price || 0) - Number(form.deposit || 0),
      status: form.status || "Đang xử lý",
    };

    const request = editingCustomer
      ? supabase.from("customers").update(payload).eq("id", editingCustomer.id)
      : supabase.from("customers").insert([
          {
            customer_code: "KH" + Date.now(),
            ...payload,
          },
        ]);

    const { error } = await request;
    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-2xl font-bold">
              {editingCustomer ? "Sửa khách hàng" : "Thêm khách hàng"}
            </h2>
            <p className="text-gray-500 text-sm mt-1">Thông tin CRM BEEN MEDIA</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-red-600">
            ✕
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2 text-sm font-medium text-slate-700">Họ và tên khách hàng
            <input className="mt-1 border p-3 rounded-lg w-full" placeholder="Ví dụ: Nguyễn Văn A" value={form.full_name} onChange={(e) => updateField("full_name", e.target.value)} />
          </label>
          <label className="text-sm font-medium text-slate-700">Số điện thoại chính
            <input className="mt-1 border p-3 rounded-lg w-full" placeholder="058..." value={form.phone} onChange={(e) => updateField("phone", e.target.value)} />
          </label>
          <label className="text-sm font-medium text-slate-700">Email
            <input className="mt-1 border p-3 rounded-lg w-full" placeholder="email@example.com" value={form.email} onChange={(e) => updateField("email", e.target.value)} />
          </label>
          <label className="text-sm font-medium text-slate-700">Địa chỉ khách hàng
            <input className="mt-1 border p-3 rounded-lg w-full" placeholder="Địa chỉ" value={form.address} onChange={(e) => updateField("address", e.target.value)} />
          </label>
          <label className="text-sm font-medium text-slate-700">Facebook / Zalo
            <input className="mt-1 border p-3 rounded-lg w-full" placeholder="Link hoặc tên tài khoản" value={form.facebook} onChange={(e) => updateField("facebook", e.target.value)} />
          </label>
          <label className="sm:col-span-2 text-sm font-medium text-slate-700">Dịch vụ / Gói khách đặt
            <input className="mt-1 border p-3 rounded-lg w-full" placeholder="Ví dụ: Combo VIP" value={form.service} onChange={(e) => updateField("service", e.target.value)} />
          </label>
          <label className="text-sm font-medium text-slate-700">Tổng giá trị hợp đồng
            <MoneyInput className="mt-1 border p-3 rounded-lg w-full" placeholder="10.000.000" value={form.total_price} onChange={(v) => updateField("total_price", v)} />
          </label>
          <label className="text-sm font-medium text-slate-700">Khách đã thanh toán / Đặt cọc
            <MoneyInput className="mt-1 border p-3 rounded-lg w-full" placeholder="3.000.000" value={form.deposit} onChange={(v) => updateField("deposit", v)} />
          </label>
          <div className="sm:col-span-2 rounded-xl bg-slate-50 p-3 text-sm"><span className="text-slate-500">Khách còn nợ — tự động tính:</span> <b className="text-red-600">{Math.max(Number(form.total_price||0)-Number(form.deposit||0),0).toLocaleString("vi-VN")} đ</b></div>
          <label className="sm:col-span-2 text-sm font-medium text-slate-700">Trạng thái khách hàng
            <select className="mt-1 border p-3 rounded-lg w-full" value={form.status} onChange={(e) => updateField("status", e.target.value)}><option>Đang xử lý</option><option>Đã đặt cọc</option><option>Đang chụp</option><option>Đang hậu kỳ</option><option>Đã bàn giao</option><option>Hủy</option></select>
          </label>
          <label className="sm:col-span-2 text-sm font-medium text-slate-700">Ghi chú khách hàng
            <textarea className="mt-1 border p-3 rounded-lg w-full min-h-28" placeholder="Ghi chú" value={form.note} onChange={(e) => updateField("note", e.target.value)} />
          </label>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-5 py-2 border rounded-lg">
            Hủy
          </button>

          <button
            onClick={saveCustomer}
            disabled={loading}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg disabled:opacity-60"
          >
            {loading ? "Đang lưu..." : editingCustomer ? "Cập nhật" : "Lưu"}
          </button>
        </div>
      </div>
    </div>
  );
}
