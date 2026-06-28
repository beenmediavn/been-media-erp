"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import MainLayout from "../components/layout/MainLayout";
import CustomerForm from "../components/CustomerForm";

const money = (value: number | null | undefined) =>
  Number(value || 0).toLocaleString("vi-VN");

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [openForm, setOpenForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const loadCustomers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("created_at", { ascending: false });

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    setCustomers(data || []);
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const deleteCustomer = async (id: string) => {
    if (!confirm("Bạn chắc chắn muốn xóa khách hàng?")) return;

    const { error } = await supabase.from("customers").delete().eq("id", id);

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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Quản lý khách hàng</h1>
          <p className="text-gray-500 mt-1">BEEN MEDIA CRM</p>
        </div>

        <button
          onClick={() => {
            setEditingCustomer(null);
            setOpenForm(true);
          }}
          className="bg-blue-600 text-white px-5 py-3 rounded-lg hover:bg-blue-700"
        >
          + Thêm khách hàng
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
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
                  <td className="p-3">
                    <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm">
                      {customer.status || "Đang xử lý"}
                    </span>
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <button
                      onClick={() => {
                        setEditingCustomer(customer);
                        setOpenForm(true);
                      }}
                      className="bg-yellow-500 text-white px-3 py-1 rounded mr-2 hover:bg-yellow-600"
                    >
                      Sửa
                    </button>

                    <button
                      onClick={() => deleteCustomer(customer.id)}
                      className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
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
