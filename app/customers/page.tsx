"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import MainLayout from "../components/layout/MainLayout";
import CustomerForm from "../components/CustomerForm";
import { requireEditPin } from "@/lib/admin-pin";
import { setOfflineCache } from "@/lib/offline-db";

const money = (value: number | null | undefined) =>
  Number(value || 0).toLocaleString("vi-VN");

// Hàm chuẩn hóa hiển thị trạng thái chuẩn xác 100%
function renderCustomerJobStatus(customer: any) {
  const total = Number(customer.total_price || 0);
  const deposit = Number(customer.deposit || 0);
  const debt = Number(customer.debt !== undefined && customer.debt !== null ? customer.debt : total - deposit);

  const jobList = Array.isArray(customer.jobs) ? customer.jobs : [];
  const primaryJob = jobList[0];
  const jobStatus = String(primaryJob?.status || customer.status || "").toLowerCase();

  // 1. Khách chưa nhập tiền hoặc Job đang tư vấn
  if (total === 0) {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
        Đang tư vấn
      </span>
    );
  }

  // 2. Job đã làm xong (hoàn thành / xong)
  const isDone =
    jobStatus.includes("xong") ||
    jobStatus.includes("hoàn thành") ||
    jobStatus.includes("done") ||
    jobStatus.includes("completed");

  if (isDone) {
    if (debt <= 0) {
      return (
        <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
          Đã xong & Hoàn thành
        </span>
      );
    }
    return (
      <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900 border border-amber-300">
        Đã xong Job (Còn nợ)
      </span>
    );
  }

  // 3. Đã thanh toán đủ toàn bộ 100%
  if (debt <= 0 && deposit >= total && total > 0) {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 border border-emerald-300">
        Đã thanh toán 100%
      </span>
    );
  }

  // 4. Chưa đặt cọc (Cọc = 0)
  if (deposit <= 0) {
    return (
      <span className="inline-flex items-center rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-700 border border-rose-200">
        Chưa đặt cọc
      </span>
    );
  }

  // 5. Đã cọc một phần đang chờ đi làm
  return (
    <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800">
      Đã đặt cọc (Chờ đi làm)
    </span>
  );
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [openForm, setOpenForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const [{ data: custData, error: custErr }, { data: jobData }] = await Promise.all([
        supabase.from("customers").select("*").order("created_at", { ascending: false }),
        supabase.from("jobs").select("id, customer_id, customer_name, customer_phone, status, total_price, deposit, debt")
      ]);

      if (custErr) {
        if (typeof navigator === "undefined" || navigator.onLine) alert(custErr.message);
        setLoading(false);
        return;
      }

      const jobsList = jobData || [];
      const merged = (custData || []).map((c: any) => {
        const matchedJobs = jobsList.filter(
          (j: any) =>
            (j.customer_id && String(j.customer_id) === String(c.id)) ||
            (c.phone && j.customer_phone && String(j.customer_phone).replace(/\D/g, "") === String(c.phone).replace(/\D/g, "") && String(c.phone).trim() !== "") ||
            (c.full_name && j.customer_name && String(j.customer_name).toLowerCase().trim() === String(c.full_name).toLowerCase().trim())
        );
        return {
          ...c,
          jobs: matchedJobs,
        };
      });

      setCustomers(merged);
      setOfflineCache("customers-data", merged).catch(() => {});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
    const synced = () => loadCustomers();
    window.addEventListener("been:offline-sync-complete", synced);
    return () => window.removeEventListener("been:offline-sync-complete", synced);
  }, []);

  const deleteCustomer = async (id: string) => {
    if (!(await requireEditPin("xóa khách hàng"))) return;
    if (!confirm("Chuyển khách hàng này vào Thùng rác 30 ngày?")) return;

    const { error } = await supabase
      .from("customers")
      .update({ deleted_at: new Date().toISOString(), deleted_by: "Admin ERP" })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    loadCustomers();
  };

  const filteredCustomers = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return customers;

    return customers.filter((customer) => {
      return (
        (customer.full_name || "").toLowerCase().includes(keyword) ||
        (customer.phone || "").includes(keyword) ||
        (customer.customer_code || "").toLowerCase().includes(keyword) ||
        (customer.service || "").toLowerCase().includes(keyword)
      );
    });
  }, [customers, search]);

  const totalRevenue = customers.reduce(
    (sum, item) => sum + Number(item.total_price || 0),
    0
  );
  const totalDeposit = customers.reduce(
    (sum, item) => sum + Number(item.deposit || 0),
    0
  );
  const totalDebt = customers.reduce(
    (sum, item) => sum + Number(item.debt || 0),
    0
  );

  return (
    <MainLayout>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Quản lý khách hàng</h1>
          <p className="text-gray-500 mt-1">BEEN MEDIA CRM</p>
        </div>

        <button
          onClick={() => {
            setEditingCustomer(null);
            setOpenForm(true);
          }}
          className="bg-blue-600 text-white px-5 py-3 rounded-lg hover:bg-blue-700 font-semibold"
        >
          + Thêm khách hàng
        </button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <div className="bg-white rounded-xl p-5 shadow">
          <p className="text-gray-500">Tổng khách</p>
          <p className="text-3xl font-bold mt-2">{customers.length}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow">
          <p className="text-gray-500">Tổng giá trị</p>
          <p className="text-2xl font-bold mt-2">{money(totalRevenue)} đ</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow">
          <p className="text-gray-500">Đã cọc/thu</p>
          <p className="text-2xl font-bold mt-2 text-green-700">
            {money(totalDeposit)} đ
          </p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow">
          <p className="text-gray-500">Còn nợ</p>
          <p className="text-2xl font-bold mt-2 text-red-600">
            {money(totalDebt)} đ
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-6">
        <input
          type="text"
          placeholder="Tìm tên khách, số điện thoại, mã KH, dịch vụ..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border rounded-lg p-3 mb-6"
        />

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px]">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="text-left p-3">Mã KH</th>
                <th className="text-left p-3">Khách hàng</th>
                <th className="text-left p-3">SĐT</th>
                <th className="text-left p-3">Dịch vụ</th>
                <th className="text-left p-3">Tổng tiền</th>
                <th className="text-left p-3">Đặt cọc</th>
                <th className="text-left p-3">Còn nợ</th>
                <th className="text-left p-3">Trạng thái</th>
                <th className="text-left p-3">Thao tác</th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td className="p-4 text-gray-500" colSpan={9}>
                    Đang tải dữ liệu...
                  </td>
                </tr>
              )}

              {!loading && filteredCustomers.length === 0 && (
                <tr>
                  <td className="p-4 text-gray-500" colSpan={9}>
                    Chưa có khách hàng phù hợp.
                  </td>
                </tr>
              )}

              {filteredCustomers.map((customer) => (
                <tr key={customer.id} className="border-b hover:bg-slate-50">
                  <td className="p-3 font-medium">{customer.customer_code}</td>
                  <td className="p-3">
                    <div className="font-semibold">{customer.full_name}</div>
                    <div className="text-xs text-gray-500">{customer.email}</div>
                  </td>
                  <td className="p-3">{customer.phone}</td>
                  <td className="p-3">{customer.service}</td>
                  <td className="p-3">{money(customer.total_price)}</td>
                  <td className="p-3 text-green-700">{money(customer.deposit)}</td>
                  <td className="p-3 text-red-600">{money(customer.debt)}</td>
                  <td className="p-3 whitespace-nowrap">
                    {renderCustomerJobStatus(customer)}
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <button
                      onClick={() => {
                        setEditingCustomer(customer);
                        setOpenForm(true);
                      }}
                      className="bg-yellow-500 text-white px-3 py-1 rounded mr-2 hover:bg-yellow-600 text-sm font-semibold"
                    >
                      Sửa
                    </button>

                    <button
                      onClick={() => deleteCustomer(customer.id)}
                      className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 text-sm font-semibold"
                    >
                      Xóa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {openForm && (
        <CustomerForm
          editingCustomer={editingCustomer}
          onClose={() => {
            setOpenForm(false);
            setEditingCustomer(null);
          }}
          onSaved={() => {
            loadCustomers();
            setOpenForm(false);
            setEditingCustomer(null);
          }}
        />
      )}
    </MainLayout>
  );
}
