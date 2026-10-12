"use client";

import { useEffect, useMemo, useState } from "react";
import MainLayout from "../components/layout/MainLayout";
import { supabase } from "@/lib/supabase";
import MoneyInput from "../components/MoneyInput";
import { formatDateVN } from "@/lib/date-vn";

// Hàm kiểm tra trạng thái Job đã hoàn thành
const isJobCompleted = (status: any) => {
  const s = String(status || "").trim().toLowerCase();
  return s.includes("hoàn thành") || s.includes("đã hoàn thành") || s.includes("đã bàn giao");
};

// Hàm kiểm tra thời gian ca chụp đã qua chưa (hết ngày hoặc hết giờ)
const isDayEnded = (day: any) => {
  const date = String(day?.shooting_date || "");
  if (!date) return false;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  if (date < today) return true;
  if (date > today) return false;
  const end = String(day?.end_time || "").slice(0, 5);
  if (!end) return false;
  const current = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return end <= current;
};

// Điều kiện bắt buộc: Job chỉ được tính lương khi đã thực tế hoàn thành hoặc hết ca
const isAssignmentDone = (a: any) => isJobCompleted(a?.jobs?.status) || isDayEnded(a?.job_days);

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [advances, setAdvances] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [postProductions, setPostProductions] = useState<any[]>([]);
  const [adjustments, setAdjustments] = useState<any[]>([]);
  
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any>(null);
  const [formData, setFormData] = useState<any>({
    full_name: "",
    phone: "",
    role: "Photographer",
    username: "",
    password: "",
    avatar_url: "",
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const formatMoney = (n: number) => Number(n || 0).toLocaleString("vi-VN") + " đ";

  const loadData = async () => {
    const { data: emp } = await supabase
      .from("employees")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    const { data: ass } = await supabase
      .from("job_assignments")
      .select("*, jobs(id, customer_name, event_name, status, deleted_at), job_days(shooting_date, start_time, end_time)");

    const { data: adv } = await supabase.from("salary_advances").select("*");
    const { data: pay } = await supabase.from("salary_payments").select("*");
    const { data: adj } = await supabase.from("salary_adjustments").select("*");

    try {
      const { data: postData } = await supabase.from("job_post_productions").select("*");
      setPostProductions(postData || []);
    } catch {
      setPostProductions([]);
    }

    setEmployees(emp || []);
    setAssignments(ass || []);
    setAdvances(adv || []);
    setPayments(pay || []);
    setAdjustments(adj || []);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Xử lý phím Esc để đóng Modal nhanh
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowModal(false);
        setEditingEmployee(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Tính toán công nợ chuẩn xác: CHỈ TÍNH JOB THỰC TẾ ĐÃ HOÀN THÀNH
  const rows = useMemo(() => {
    return employees.map((emp) => {
      const empAssignmentsAll = (assignments || []).filter(
        (a) => a.employee_id === emp.id && !a.jobs?.deleted_at
      );

      // Lọc ra các Job đã xong
      const empAssignmentsDone = empAssignmentsAll.filter((a) => isAssignmentDone(a));

      // Lương phát sinh thực tế (chỉ tính job đã xong)
      const baseSalaryDone = empAssignmentsDone.reduce((sum, a) => sum + Number(a.salary_amount || 0), 0);

      // Hậu kỳ hoàn thành
      const empPostsDone = (postProductions || []).filter(
        (p) => p.assigned_user_id === emp.id && p.status === "COMPLETED"
      );
      const postSalary = empPostsDone.reduce((sum, p) => sum + Number(p.actual_price || p.default_price || 0), 0);

      // Thưởng / phạt của nhân sự
      const empAdj = (adjustments || []).filter((a) => a.employee_id === emp.id);
      const adjTotal = empAdj.reduce((sum, a) => sum + Number(a.amount || 0), 0);

      // Tổng lương thực nhận = Job xong + Hậu kỳ + Thưởng/phạt
      const totalEarned = baseSalaryDone + postSalary + adjTotal;

      const totalAdvance = (advances || [])
        .filter((a) => a.employee_id === emp.id)
        .reduce((sum, a) => sum + Number(a.amount || 0), 0);

      const totalPaid = (payments || [])
        .filter((p) => p.employee_id === emp.id)
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);

      // Công nợ thực tế Been Media còn phải trả thợ
      const remain = Math.max(totalEarned - totalAdvance - totalPaid, 0);

      return {
        ...emp,
        doneJobsCount: empAssignmentsDone.length,
        totalJobsCount: empAssignmentsAll.length,
        earnedSalary: totalEarned,
        totalAdvance,
        totalPaid,
        remain,
      };
    });
  }, [employees, assignments, postProductions, adjustments, advances, payments]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.full_name, r.phone, r.role, r.username].some((val) =>
        String(val || "").toLowerCase().includes(q)
      )
    );
  }, [rows, search]);

  const totalEarnedAll = rows.reduce((s, r) => s + r.earnedSalary, 0);
  const totalAdvanceAll = rows.reduce((s, r) => s + r.totalAdvance, 0);
  const totalRemainAll = rows.reduce((s, r) => s + r.remain, 0);

  // Mở modal thêm/sửa
  const openEdit = (emp?: any) => {
    if (emp) {
      setEditingEmployee(emp);
      setFormData({
        full_name: emp.full_name || "",
        phone: emp.phone || "",
        role: emp.role || "Photographer",
        username: emp.username || "",
        password: "",
        avatar_url: emp.avatar_url || "",
      });
    } else {
      setEditingEmployee(null);
      setFormData({
        full_name: "",
        phone: "",
        role: "Photographer",
        username: "",
        password: "",
        avatar_url: "",
      });
    }
    setAvatarFile(null);
    setShowModal(true);
  };

  // Tải ảnh đại diện từ điện thoại hoặc máy tính
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAvatarFile(e.target.files[0]);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploading(true);

    let avatar_url = formData.avatar_url;

    if (avatarFile) {
      const ext = avatarFile.name.split(".").pop();
      const filePath = `avatars/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, avatarFile);
      if (!uploadError) {
        const { data: pubData } = supabase.storage.from("avatars").getPublicUrl(filePath);
        avatar_url = pubData.publicUrl;
      }
    }

    const payload: any = {
      full_name: formData.full_name,
      phone: formData.phone,
      role: formData.role,
      username: formData.username,
      avatar_url,
    };
    if (formData.password) {
      payload.password = formData.password;
    }

    if (editingEmployee) {
      const { error } = await supabase.from("employees").update(payload).eq("id", editingEmployee.id);
      if (error) alert("Lỗi cập nhật: " + error.message);
    } else {
      const { error } = await supabase.from("employees").insert([payload]);
      if (error) alert("Lỗi thêm nhân sự: " + error.message);
    }

    setIsUploading(false);
    setShowModal(false);
    loadData();
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Bạn có chắc muốn xóa nhân sự "${name}"?`)) return;
    const { error } = await supabase.from("employees").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) alert("Lỗi khi xóa: " + error.message);
    else loadData();
  };

  return (
    <MainLayout>
      <div className="space-y-5">
        {/* Header trang */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Nhân sự</h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Danh sách thợ, tài khoản đăng nhập và đối soát lương theo Job đã hoàn thành
            </p>
          </div>
          <button
            onClick={() => openEdit()}
            className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-all self-start sm:self-auto"
          >
            <span>+</span> Thêm nhân sự
          </button>
        </div>

        {/* 3 Thẻ thống kê chuẩn xác */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">Tổng nhân sự</p>
            <p className="mt-1 text-2xl font-black text-slate-800">{employees.length}</p>
          </div>
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">Lương thực tế đã xong</p>
            <p className="mt-1 text-xl font-black text-emerald-600">{formatMoney(totalEarnedAll)}</p>
          </div>
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">Đã ứng</p>
            <p className="mt-1 text-xl font-black text-amber-600">{formatMoney(totalAdvanceAll)}</p>
          </div>
          <div className="rounded-2xl border border-rose-200 bg-rose-50/30 p-4 shadow-sm">
            <p className="text-xs font-semibold text-rose-600">Còn phải trả</p>
            <p className="mt-1 text-xl font-black text-rose-600">{formatMoney(totalRemainAll)}</p>
          </div>
        </div>

        {/* Thanh tìm kiếm */}
        <div className="flex items-center justify-between">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên, SĐT, tài khoản, vai trò..."
            className="w-full max-w-md rounded-xl border bg-white px-3.5 py-2.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Bảng danh sách - Desktop */}
        <div className="hidden lg:block overflow-hidden rounded-2xl border bg-white shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="border-b bg-slate-50 text-[11px] font-semibold uppercase text-slate-600">
              <tr>
                <th className="p-3.5">Nhân sự</th>
                <th className="p-3.5">Vai trò</th>
                <th className="p-3.5">User</th>
                <th className="p-3.5 text-center">Job xong</th>
                <th className="p-3.5 text-right">Lương phát sinh</th>
                <th className="p-3.5 text-right">Đã ứng</th>
                <th className="p-3.5 text-right">Đã thanh toán</th>
                <th className="p-3.5 text-right">Còn phải trả</th>
                <th className="p-3.5 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y text-slate-700">
              {filteredRows.map((emp) => (
                <tr key={emp.id} className="hover:bg-slate-50/60">
                  <td className="p-3.5">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 overflow-hidden rounded-full border bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-xs">
                        {emp.avatar_url ? (
                          <img src={emp.avatar_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          emp.full_name?.slice(0, 1) || "NV"
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">{emp.full_name}</p>
                        <p className="text-[11px] text-slate-400">{emp.phone || "Chưa có SĐT"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-3.5 font-medium">{emp.role}</td>
                  <td className="p-3.5 text-slate-500">{emp.username}</td>
                  <td className="p-3.5 text-center font-semibold text-blue-600">
                    {emp.doneJobsCount}
                  </td>
                  <td className="p-3.5 text-right font-bold text-slate-800">
                    {formatMoney(emp.earnedSalary)}
                  </td>
                  <td className="p-3.5 text-right font-medium text-amber-600">
                    {emp.totalAdvance > 0 ? "-" + formatMoney(emp.totalAdvance) : "0 đ"}
                  </td>
                  <td className="p-3.5 text-right font-medium text-emerald-600">
                    {formatMoney(emp.totalPaid)}
                  </td>
                  <td className="p-3.5 text-right font-black">
                    {emp.remain > 0 ? (
                      <span className="text-rose-600">{formatMoney(emp.remain)}</span>
                    ) : (
                      <span className="text-slate-400">0 đ</span>
                    )}
                  </td>
                  <td className="p-3.5 text-center whitespace-nowrap space-x-1.5">
                    <button
                      onClick={() => openEdit(emp)}
                      className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-600"
                    >
                      Sửa
                    </button>
                    <button
                      onClick={() => handleDelete(emp.id, emp.full_name)}
                      className="rounded-lg bg-rose-600 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-700"
                    >
                      Xóa
                    </button>
                  </td>
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-slate-400">
                    Không tìm thấy nhân sự phù hợp
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Danh sách thẻ - Mobile (Tối ưu chống tràn) */}
        <div className="space-y-3 lg:hidden">
          {filteredRows.map((emp) => (
            <div key={emp.id} className="rounded-2xl border bg-white p-4 shadow-sm text-xs">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-10 w-10 overflow-hidden rounded-full border bg-slate-100 flex items-center justify-center font-bold text-slate-600">
                    {emp.avatar_url ? (
                      <img src={emp.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      emp.full_name?.slice(0, 1) || "NV"
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-sm text-slate-800">{emp.full_name}</p>
                    <p className="text-slate-400">{emp.phone} • {emp.role}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block">Còn phải trả</span>
                  <span className={`font-black text-sm ${emp.remain > 0 ? "text-rose-600" : "text-slate-500"}`}>
                    {emp.remain > 0 ? formatMoney(emp.remain) : "0 đ"}
                  </span>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 border-t pt-2.5 text-center">
                <div className="bg-slate-50 p-2 rounded-lg">
                  <span className="text-[10px] text-slate-400 block">Job đã xong</span>
                  <b className="text-blue-600 font-bold">{emp.doneJobsCount}</b>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg">
                  <span className="text-[10px] text-slate-400 block">Lương phát sinh</span>
                  <b className="text-slate-700">{formatMoney(emp.earnedSalary)}</b>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg">
                  <span className="text-[10px] text-slate-400 block">Đã ứng</span>
                  <b className="text-amber-600">{formatMoney(emp.totalAdvance)}</b>
                </div>
              </div>

              <div className="mt-3 flex gap-2 border-t pt-2.5">
                <button
                  onClick={() => openEdit(emp)}
                  className="flex-1 rounded-xl bg-amber-500 py-2 font-semibold text-white text-xs"
                >
                  Sửa thông tin
                </button>
                <button
                  onClick={() => handleDelete(emp.id, emp.full_name)}
                  className="rounded-xl bg-rose-600 px-4 py-2 font-semibold text-white text-xs"
                >
                  Xóa
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MODAL THÊM / SỬA NHÂN SỰ & THAY ẢNH ĐẠI DIỆN (CÓ NÚT X DÍNH TRÊN ĐẦU) */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
            
            {/* Header dính trên đầu có nút X đóng nhanh */}
            <div className="sticky top-0 z-20 flex items-center justify-between bg-white px-5 py-4 border-b rounded-t-2xl">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-800">
                  {editingEmployee ? "Sửa thông tin nhân sự" : "Thêm nhân sự mới"}
                </h3>
                <p className="text-xs text-slate-400">Quản lý hồ sơ và phân quyền thợ</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 font-bold"
                title="Đóng (Esc)"
              >
                ✕
              </button>
            </div>

            {/* Nội dung form nhập */}
            <form onSubmit={handleSave} className="p-5 overflow-y-auto space-y-4 text-xs text-slate-700 flex-1">
              
              {/* Tải ảnh đại diện từ điện thoại hoặc máy tính */}
              <div className="flex items-center gap-4 border p-3 rounded-xl bg-slate-50">
                <div className="h-16 w-16 overflow-hidden rounded-full border bg-white flex items-center justify-center font-bold text-slate-400 text-sm">
                  {avatarFile ? (
                    <img src={URL.createObjectURL(avatarFile)} alt="Preview" className="h-full w-full object-cover" />
                  ) : formData.avatar_url ? (
                    <img src={formData.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
                  ) : (
                    "Ảnh"
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Ảnh đại diện</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Hỗ trợ chọn ảnh nét từ máy tính hoặc điện thoại</p>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Họ và tên *</label>
                <input
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="VD: Nguyễn Văn A"
                  className="w-full rounded-xl border p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Số điện thoại *</label>
                  <input
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="0912..."
                    className="w-full rounded-xl border p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Vai trò</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full rounded-xl border p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  >
                    <option value="Photographer">Photographer</option>
                    <option value="CAMERAMEN">CAMERAMEN</option>
                    <option value="Flycam">Flycam</option>
                    <option value="Editor">Editor (Hậu kỳ)</option>
                    <option value="Make up">Make up</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 border-t pt-3">
                <div>
                  <label className="block font-semibold mb-1">Tên đăng nhập (User) *</label>
                  <input
                    required
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="VD: thanhtoan1"
                    className="w-full rounded-xl border p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">
                    {editingEmployee ? "Đổi mật khẩu (nếu cần)" : "Mật khẩu *"}
                  </label>
                  <input
                    type="password"
                    required={!editingEmployee}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••"
                    className="w-full rounded-xl border p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="sticky bottom-0 bg-white pt-3 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl border px-4 py-2 font-semibold hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="rounded-xl bg-blue-600 px-5 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isUploading ? "Đang lưu..." : "Lưu nhân sự"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
