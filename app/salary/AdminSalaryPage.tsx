"use client";

import { useEffect, useMemo, useState } from "react";
import MainLayout from "../components/layout/MainLayout";
import { supabase } from "@/lib/supabase";
import MoneyInput from "../components/MoneyInput";
import { formatDateVN } from "@/lib/date-vn";
import { requireEditPin } from "@/lib/admin-pin";

type SalaryFilter = "all" | "paid" | "unpaid" | "debt" | "advance";

const jobCompleted = (status: any) => {
  const s = String(status || "").trim().toLowerCase();
  return s.includes("hoàn thành") || s.includes("đã hoàn thành") || s.includes("đã bàn giao");
};

const dayHasEnded = (day: any) => {
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

const assignmentCompleted = (a: any) => jobCompleted(a?.jobs?.status) || dayHasEnded(a?.job_days);

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
  const [postProductions, setPostProductions] = useState<any[]>([]);
  const [advances, setAdvances] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [showPenalty, setShowPenalty] = useState(false);
  const [penaltyForm, setPenaltyForm] = useState<any>({
    employee_id: "",
    amount: 0,
    note: "",
    adjustment_date: new Date().toISOString().slice(0, 10),
    adjustment_type: "penalty",
  });
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [statementEmployee, setStatementEmployee] = useState<any>(null);
  const [statementType, setStatementType] = useState<"ACCUMULATED" | "MONTHLY">("ACCUMULATED");
  const [statementMonth, setStatementMonth] = useState(new Date().toISOString().slice(0, 7));
  const [isSendingStatement, setIsSendingStatement] = useState(false);

  const [filter, setFilter] = useState<SalaryFilter>("all");
  const [search, setSearch] = useState("");
  const [editingTxn, setEditingTxn] = useState<any>(null);

  // Mặc định chọn "ALL" để lũy kế nợ từ trước đến nay, vẫn cho phép chọn theo tháng cụ thể
  const [month, setMonth] = useState<string>("ALL");

  const formatMoney = (n: number) => Number(n || 0).toLocaleString("vi-VN") + " đ";

  const loadData = async () => {
    const { data: emp } = await supabase.from("employees").select("*").is("deleted_at", null).order("created_at", { ascending: false });
    const { data: ass } = await supabase
      .from("job_assignments")
      .select("*, jobs(id, customer_name, event_name, service, status, deleted_at), job_days(shooting_date,start_time,end_time)");
    const { data: adv } = await supabase.from("salary_advances").select("*").order("advance_date", { ascending: false });
    const { data: pay } = await supabase.from("salary_payments").select("*").order("payment_date", { ascending: false });
    const { data: adj } = await supabase.from("salary_adjustments").select("*, jobs(event_name,customer_name)").order("adjustment_date", { ascending: false });
    
    // Nạp thêm phân công hậu kỳ (nếu bảng tồn tại)
    try {
      const { data: postData } = await supabase.from("job_post_productions").select("*, jobs(id, customer_name, event_name)");
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

  // Lắng nghe phím ESC để đóng Modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedEmployee(null);
        setStatementEmployee(null);
        setEditingTxn(null);
        setShowPenalty(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Lọc theo tháng hoặc lấy toàn bộ nếu month === 'ALL'
  const filteredAssignments = useMemo(() => {
    if (month === "ALL") return assignments.filter((a) => !a.jobs?.deleted_at);
    return assignments.filter((a) => a.job_days?.shooting_date?.startsWith(month) && !a.jobs?.deleted_at);
  }, [assignments, month]);

  const filteredAdvances = useMemo(() => {
    if (month === "ALL") return advances;
    return advances.filter((a) => a.advance_date?.startsWith(month));
  }, [advances, month]);

  const filteredPayments = useMemo(() => {
    if (month === "ALL") return payments;
    return payments.filter((p) => p.payment_date?.startsWith(month));
  }, [payments, month]);

  const filteredAdjustments = useMemo(() => {
    if (month === "ALL") return adjustments;
    return adjustments.filter((a) => a.adjustment_date?.startsWith(month));
  }, [adjustments, month]);

  const rows = useMemo(() => {
    return employees.map((emp) => {
      const empAssignmentsRaw = filteredAssignments.filter((a) => a.employee_id === emp.id);

      // Khử trùng phân công
      const seenAssignments = new Set<string>();
      const empAssignmentsAll = empAssignmentsRaw.filter((a: any) => {
        const key = [
          String(a.job_id || ""),
          String(a.job_day_id || a.job_days?.shooting_date || ""),
          String(a.employee_id || ""),
          String(a.role || "").trim().toLowerCase(),
          String(a.work_location_name || "").trim().toLowerCase(),
          String(a.work_location_address || "").trim().toLowerCase(),
          String(a.job_days?.start_time || "").slice(0, 5),
          String(a.job_days?.end_time || "").slice(0, 5),
        ].join("|");
        if (seenAssignments.has(key)) return false;
        seenAssignments.add(key);
        return true;
      });

      // Chỉ Job đã hoàn thành mới cộng nợ lương
      const empAssignments = empAssignmentsAll.filter((a) => assignmentCompleted(a));
      const assignedSalary = empAssignmentsAll.reduce((sum, a) => sum + Number(a.salary_amount || 0), 0);
      const baseSalary = empAssignments.reduce((sum, a) => sum + Number(a.salary_amount || 0), 0);

      // Thu nhập hậu kỳ (Edit video, Photoshop)
      const empPosts = postProductions.filter(
        (p: any) =>
          p.assigned_user_id === emp.id &&
          p.status === "COMPLETED" &&
          (month === "ALL" || (p.completed_at && p.completed_at.startsWith(month)))
      );
      const postSalary = empPosts.reduce((sum, p) => sum + Number(p.actual_price || p.default_price || 0), 0);

      const allEmployeeAdjustments = filteredAdjustments.filter((a) => a.employee_id === emp.id);
      const completedJobIds = new Set(empAssignments.map((a: any) => a.job_id));
      const employeeAdjustments = allEmployeeAdjustments.filter((a: any) => !a.job_id || completedJobIds.has(a.job_id));
      const adjustmentTotal = employeeAdjustments.reduce((sum, a) => sum + Number(a.amount || 0), 0);

      const totalSalary = baseSalary + postSalary + adjustmentTotal;
      const totalAdvance = filteredAdvances.filter((a) => a.employee_id === emp.id).reduce((sum, a) => sum + Number(a.amount || 0), 0);
      const totalPaid = filteredPayments.filter((p) => p.employee_id === emp.id).reduce((sum, p) => sum + Number(p.amount || 0), 0);
      
      const remainRaw = totalSalary - totalAdvance - totalPaid;
      const remain = Math.max(remainRaw, 0);
      const overpaid = Math.max(-remainRaw, 0);

      // Phân bổ thanh toán FIFO
      let paidPool = totalAdvance + totalPaid;
      const salaryJobs = [...empAssignments]
        .sort((a: any, b: any) => String(a.job_days?.shooting_date || "").localeCompare(String(b.job_days?.shooting_date || "")))
        .map((a: any) => {
          const linkedAdj = employeeAdjustments.filter((x: any) => x.job_id === a.job_id).reduce((sum: number, x: any) => sum + Number(x.amount || 0), 0);
          const due = Math.max(Number(a.salary_amount || 0) + linkedAdj, 0);
          const allocated = Math.min(Math.max(paidPool, 0), due);
          paidPool = Math.max(paidPool - allocated, 0);
          return { ...a, jobDue: due, jobPaid: allocated, jobRemain: Math.max(due - allocated, 0) };
        });

      return {
        ...emp,
        assignedSalary: assignedSalary + postSalary,
        baseSalary: baseSalary + postSalary,
        postSalary,
        adjustmentTotal,
        employeeAdjustments,
        totalSalary,
        totalAdvance,
        totalPaid,
        remain,
        remainRaw,
        overpaid,
        jobs: empAssignmentsAll,
        completedJobs: empAssignments,
        postJobs: empPosts,
        salaryJobs,
      };
    });
  }, [employees, filteredAssignments, postProductions, filteredAdvances, filteredPayments, filteredAdjustments, month]);

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

  const totalAssignedSalary = rows.reduce((s, r) => s + r.assignedSalary, 0);
  const totalCompletedSalary = rows.reduce((s, r) => s + r.baseSalary, 0);
  const totalAdvance = rows.reduce((s, r) => s + r.totalAdvance, 0);
  const totalPaid = rows.reduce((s, r) => s + r.totalPaid, 0);
  const totalRemain = rows.reduce((s, r) => s + r.remain, 0);
  const debtRows = rows.filter((r) => r.remain > 0).sort((a, b) => b.remain - a.remain);

  const addAdvance = async (employeeId: string) => {
    const amount = Number(prompt("Nhập số tiền ứng:") || 0);
    if (!amount) return;

    const today = new Date().toISOString().slice(0, 10);
    const { data: row, error } = await supabase
      .from("salary_advances")
      .insert([{ employee_id: employeeId, amount, advance_date: today, note: "Ứng lương" }])
      .select("id")
      .single();
    if (error) return alert(error.message);
    if (row) {
      await supabase.from("finance_transactions").insert([
        {
          transaction_date: today,
          transaction_type: "expense",
          amount,
          category: "Ứng lương",
          description: "Ứng lương nhân sự",
          employee_id: employeeId,
          source_type: "salary_advance",
          source_id: row.id,
        },
      ]);
    }
    loadData();
  };

  const addPayment = async (employeeId: string, maxAmount?: number) => {
    const amount = Number(prompt("Nhập số tiền thanh toán lương:", String(Math.max(Number(maxAmount || 0), 0))) || 0);
    if (!amount) return;

    const today = new Date().toISOString().slice(0, 10);
    const { data: row, error } = await supabase
      .from("salary_payments")
      .insert([{ employee_id: employeeId, amount, payment_date: today, note: "Thanh toán lương" }])
      .select("id")
      .single();
    if (error) return alert(error.message);
    if (row) {
      await supabase.from("finance_transactions").insert([
        {
          transaction_date: today,
          transaction_type: "expense",
          amount,
          category: "Lương thợ",
          description: "Thanh toán lương nhân sự",
          employee_id: employeeId,
          source_type: "salary_payment",
          source_id: row.id,
        },
      ]);
    }
    loadData();
  };

  const openTxnEdit = (type: "advance" | "payment", row: any) => setEditingTxn({ type, ...row });
  const saveTxnEdit = async () => {
    if (!editingTxn) return;
    const table = editingTxn.type === "advance" ? "salary_advances" : "salary_payments";
    const dateKey = editingTxn.type === "advance" ? "advance_date" : "payment_date";
    const { error } = await supabase
      .from(table)
      .update({ amount: Number(editingTxn.amount || 0), [dateKey]: editingTxn[dateKey], note: editingTxn.note || "" })
      .eq("id", editingTxn.id);
    if (error) return alert(error.message);
    await supabase
      .from("finance_transactions")
      .update({
        amount: Number(editingTxn.amount || 0),
        transaction_date: editingTxn[dateKey],
        description: editingTxn.note || (editingTxn.type === "advance" ? "Ứng lương" : "Thanh toán lương"),
      })
      .eq("source_type", editingTxn.type === "advance" ? "salary_advance" : "salary_payment")
      .eq("source_id", editingTxn.id);
    setEditingTxn(null);
    loadData();
  };

  const deleteTxn = async (type: "advance" | "payment", row: any) => {
    if (!(await requireEditPin("xóa giao dịch lương"))) return;
    if (!confirm(`Xóa giao dịch ${formatMoney(row.amount)}?`)) return;
    const table = type === "advance" ? "salary_advances" : "salary_payments";
    const { error } = await supabase.from(table).delete().eq("id", row.id);
    if (error) return alert(error.message);
    await supabase
      .from("finance_transactions")
      .delete()
      .eq("source_type", type === "advance" ? "salary_advance" : "salary_payment")
      .eq("source_id", row.id);
    loadData();
  };

  const openPenalty = (employeeId: string) => {
    setPenaltyForm({ employee_id: employeeId, amount: 0, note: "", adjustment_date: new Date().toISOString().slice(0, 10), adjustment_type: "penalty" });
    setShowPenalty(true);
  };
  const openBonus = (employeeId: string) => {
    setPenaltyForm({ employee_id: employeeId, amount: 0, note: "", adjustment_date: new Date().toISOString().slice(0, 10), adjustment_type: "bonus" });
    setShowPenalty(true);
  };

  const savePenalty = async () => {
    if (!penaltyForm.employee_id) return alert("Chưa chọn nhân sự");
    const amount = Math.abs(Number(penaltyForm.amount || 0));
    if (!amount) return alert(penaltyForm.adjustment_type === "bonus" ? "Nhập số tiền thưởng" : "Nhập số tiền khấu trừ");
    if (!String(penaltyForm.note || "").trim()) return alert(penaltyForm.adjustment_type === "bonus" ? "Nhập nội dung thưởng" : "Nhập nội dung vi phạm");
    const { error } = await supabase.from("salary_adjustments").insert([
      {
        employee_id: penaltyForm.employee_id,
        adjustment_date: penaltyForm.adjustment_date,
        adjustment_type: penaltyForm.adjustment_type || "penalty",
        amount: penaltyForm.adjustment_type === "bonus" ? amount : -amount,
        note: penaltyForm.note,
        received_by_studio: false,
      },
    ]);
    if (error) return alert(error.message);
    setShowPenalty(false);
    loadData();
  };

  // Hàm xác nhận gửi sao kê lương cho thợ
  const handleConfirmSendStatement = async () => {
    if (!statementEmployee || isSendingStatement) return;
    setIsSendingStatement(true);

    const code = `STMT-${Date.now()}-${statementEmployee.id.slice(0, 4).toUpperCase()}`;
    const payload = {
      statement_code: code,
      user_id: statementEmployee.id,
      statement_type: statementType,
      period_month: statementType === "MONTHLY" ? Number(statementMonth.split("-")[1]) : null,
      period_year: statementType === "MONTHLY" ? Number(statementMonth.split("-")[0]) : null,
      cutoff_date: new Date().toISOString().slice(0, 10),
      job_earnings: statementEmployee.baseSalary,
      post_prod_earnings: statementEmployee.postSalary || 0,
      bonus_amount: statementEmployee.adjustmentTotal > 0 ? statementEmployee.adjustmentTotal : 0,
      penalty_amount: statementEmployee.adjustmentTotal < 0 ? Math.abs(statementEmployee.adjustmentTotal) : 0,
      advances_amount: statementEmployee.totalAdvance,
      paid_amount: statementEmployee.totalPaid,
      closing_balance: statementEmployee.remain,
      breakdown_data: {
        jobs: statementEmployee.salaryJobs || [],
        postJobs: statementEmployee.postJobs || [],
        adjustments: statementEmployee.employeeAdjustments || [],
      },
      status: "SENT",
    };

    const { error } = await supabase.from("salary_statements").insert([payload]);
    setIsSendingStatement(false);
    if (error) {
      alert("Lỗi gửi sao kê: " + error.message);
    } else {
      alert(`Đã gửi sao kê thành công cho ${statementEmployee.full_name}! Mã: ${code}`);
      setStatementEmployee(null);
    }
  };

  return (
    <MainLayout>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Lương nhân sự</h1>
          <p className="text-gray-500">Theo dõi lương phát sinh, ứng lương, đã trả và còn nợ lương</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-xl border bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Tìm nhân sự, SĐT..."
          />
          <div className="flex items-center gap-2">
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="border rounded-xl p-3 bg-white text-sm font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Tất cả thời gian (Cộng dồn nợ)</option>
              <option value={new Date().toISOString().slice(0, 7)}>Tháng hiện tại ({new Date().toISOString().slice(0, 7)})</option>
              <option value="2026-09">Tháng 09/2026</option>
              <option value="2026-08">Tháng 08/2026</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6 mb-5">
        <div className="bg-white rounded-xl p-4 shadow">
          <p className="text-gray-500 text-xs">Nhân sự</p>
          <p className="text-2xl font-bold">{employees.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow">
          <p className="text-gray-500 text-xs">Tổng lương đã phân công</p>
          <p className="text-xl font-bold">{formatMoney(totalAssignedSalary)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow">
          <p className="text-gray-500 text-xs">Lương Job đã xong</p>
          <p className="text-xl font-bold text-emerald-600">{formatMoney(totalCompletedSalary)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow">
          <p className="text-gray-500 text-xs">Đã ứng</p>
          <p className="text-xl font-bold text-orange-600">{formatMoney(totalAdvance)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow">
          <p className="text-gray-500 text-xs">Đã trả</p>
          <p className="text-xl font-bold text-green-600">{formatMoney(totalPaid)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow col-span-2 lg:col-span-1 border-rose-200 bg-rose-50/20">
          <p className="text-rose-600 text-xs font-semibold">BEEN MEDIA còn phải trả thợ</p>
          <p className="text-xl font-bold text-red-600">{formatMoney(totalRemain)}</p>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.key}
            onClick={() => setFilter(item.key)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
              filter === item.key ? "bg-blue-600 text-white shadow-sm" : "bg-white text-slate-700 border hover:bg-slate-50"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {debtRows.length > 0 && (
        <div className="mb-6 rounded-2xl bg-red-50 p-4 shadow-sm border border-red-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-red-700">Danh sách còn nợ lương ({debtRows.length} người)</h2>
            <span className="text-xs text-red-500 font-medium">Lũy kế cộng dồn các job chưa trả</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {debtRows.slice(0, 9).map((emp) => (
              <div key={emp.id} className="rounded-xl bg-white p-3 border shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-slate-800">{emp.full_name}</p>
                      <p className="text-xs text-slate-500">{emp.role}</p>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-rose-50 text-rose-600 font-semibold border border-rose-200">
                      Nợ lũy kế
                    </span>
                  </div>
                  <p className="mt-2 text-red-600 font-bold text-base">Còn nợ: {formatMoney(emp.remain)}</p>
                  {emp.totalAdvance > 0 && (
                    <p className="text-xs text-amber-600 font-medium">Đã ứng: {formatMoney(emp.totalAdvance)}</p>
                  )}
                </div>
                <div className="mt-3 flex gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => {
                      setStatementEmployee(emp);
                      setStatementType("ACCUMULATED");
                    }}
                    className="flex-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    Sao kê lương
                  </button>
                  <button
                    onClick={() => addPayment(emp.id, emp.remain)}
                    className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
                  >
                    Trả lương
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bảng lương chi tiết */}
      <div className="bg-white rounded-xl shadow p-4 sm:p-6">
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[1000px] text-xs">
            <thead>
              <tr className="border-b bg-gray-50 text-slate-600 uppercase">
                <th className="text-left p-3">Nhân sự</th>
                <th className="text-left p-3">Vai trò</th>
                <th className="text-center p-3">Job xong</th>
                <th className="text-right p-3">Lương Job + Hậu kỳ</th>
                <th className="text-right p-3">Phát sinh +/-</th>
                <th className="text-right p-3">Lương sau phát sinh</th>
                <th className="text-right p-3">Đã ứng</th>
                <th className="text-right p-3">Đã thanh toán</th>
                <th className="text-right p-3">Còn phải trả</th>
                <th className="text-center p-3">Trạng thái</th>
                <th className="text-center p-3">Thao tác</th>
              </tr>
            </thead>

            <tbody>
              {filteredRows.map((emp) => {
                let statusBadge = null;
                if (emp.jobs.length === 0 && emp.totalSalary === 0 && emp.totalAdvance === 0) {
                  statusBadge = <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">Chưa có lương</span>;
                } else if (emp.overpaid > 0) {
                  statusBadge = <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">Trả dư {formatMoney(emp.overpaid)}</span>;
                } else if (emp.remain > 0) {
                  statusBadge = <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-semibold">Còn nợ lương</span>;
                } else if (emp.totalSalary > 0) {
                  statusBadge = <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">Đã thanh toán đủ</span>;
                } else {
                  statusBadge = <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">Chưa có lương</span>;
                }

                return (
                  <tr key={emp.id} className="border-b hover:bg-slate-50/75">
                    <td className="p-3 font-bold text-slate-800">{emp.full_name}</td>
                    <td className="p-3 text-slate-500">{emp.role}</td>
                    <td className="p-3 text-center">{emp.completedJobs.length}</td>
                    <td className="p-3 text-right font-bold">{formatMoney(emp.baseSalary)}</td>
                    <td className={`p-3 text-right font-semibold ${emp.adjustmentTotal < 0 ? "text-red-600" : "text-emerald-700"}`}>
                      {emp.adjustmentTotal >= 0 ? "+" : ""}{formatMoney(emp.adjustmentTotal)}
                    </td>
                    <td className="p-3 text-right font-bold">{formatMoney(emp.totalSalary)}</td>
                    <td className="p-3 text-right text-orange-600 font-medium">{emp.totalAdvance > 0 ? "-" + formatMoney(emp.totalAdvance) : "0 đ"}</td>
                    <td className="p-3 text-right text-green-600 font-medium">{formatMoney(emp.totalPaid)}</td>
                    <td className="p-3 text-right font-black text-sm">
                      {emp.remain > 0 ? <span className="text-red-600">{formatMoney(emp.remain)}</span> : <span className="text-slate-600">0 đ</span>}
                    </td>
                    <td className="p-3 text-center">{statusBadge}</td>
                    <td className="p-3 text-center space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => {
                          setStatementEmployee(emp);
                          setStatementType("ACCUMULATED");
                        }}
                        className="bg-blue-600 text-white px-2.5 py-1 rounded font-semibold hover:bg-blue-700"
                      >
                        Sao kê
                      </button>
                      <button onClick={() => setSelectedEmployee(emp)} className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded border hover:bg-slate-200">
                        Chi tiết
                      </button>
                      <button onClick={() => addAdvance(emp.id)} className="bg-amber-500 text-white px-2.5 py-1 rounded hover:bg-amber-600">
                        Ứng
                      </button>
                      <button onClick={() => addPayment(emp.id, emp.remain)} className="bg-green-600 text-white px-2.5 py-1 rounded hover:bg-green-700">
                        Thanh toán
                      </button>
                      <button onClick={() => openBonus(emp.id)} className="bg-emerald-600 text-white px-2.5 py-1 rounded hover:bg-emerald-700">
                        Thưởng
                      </button>
                      <button onClick={() => openPenalty(emp.id)} className="bg-rose-600 text-white px-2.5 py-1 rounded hover:bg-rose-700">
                        Phạt
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredRows.length === 0 && (
                <tr>
                  <td className="p-4 text-center text-gray-500" colSpan={11}>
                    Không có nhân sự phù hợp bộ lọc.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Giao diện di động */}
        <div className="space-y-3 lg:hidden">
          {filteredRows.map((emp) => (
            <div key={emp.id} className="rounded-2xl border p-4 text-xs">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-sm text-slate-800">{emp.full_name}</p>
                  <p className="text-slate-500">{emp.role} • {emp.completedJobs.length} job đã xong</p>
                </div>
                <p className={`font-bold text-sm ${emp.remain > 0 ? "text-red-600" : "text-green-600"}`}>
                  {emp.remain > 0 ? formatMoney(emp.remain) : "0 đ"}
                </p>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-2">
                <p>Lương Job: <b>{formatMoney(emp.baseSalary)}</b></p>
                <p>Phát sinh: <b className={emp.adjustmentTotal < 0 ? "text-red-600" : "text-emerald-700"}>{formatMoney(emp.adjustmentTotal)}</b></p>
                <p>Đã ứng: <b className="text-orange-600">{formatMoney(emp.totalAdvance)}</b></p>
                <p>Đã trả: <b className="text-green-600">{formatMoney(emp.totalPaid)}</b></p>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5 pt-2 border-t">
                <button
                  onClick={() => {
                    setStatementEmployee(emp);
                    setStatementType("ACCUMULATED");
                  }}
                  className="flex-1 rounded-lg bg-blue-600 p-2 text-white font-semibold"
                >
                  Sao kê
                </button>
                <button onClick={() => setSelectedEmployee(emp)} className="rounded-lg bg-slate-100 p-2 text-slate-700 border">
                  Xem Job
                </button>
                <button onClick={() => addAdvance(emp.id)} className="rounded-lg bg-amber-500 p-2 text-white">
                  Ứng
                </button>
                <button onClick={() => addPayment(emp.id, emp.remain)} className="rounded-lg bg-green-600 p-2 text-white">
                  Trả lương
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MODAL SAO KÊ LƯƠNG ĐỐI SOÁT */}
      {statementEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[92vh]">
            {/* Header dính trên cùng */}
            <div className="sticky top-0 z-20 flex items-center justify-between bg-white px-5 sm:px-6 py-4 border-b rounded-t-2xl">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-800">
                  Sao kê lương: {statementEmployee.full_name}
                </h3>
                <p className="text-xs text-slate-500">{statementEmployee.role} • Mã NV: {statementEmployee.id.slice(0, 8)}</p>
              </div>
              <button
                onClick={() => setStatementEmployee(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                title="Đóng (Esc)"
              >
                ✕
              </button>
            </div>

            {/* Nội dung sao kê */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs text-slate-700 flex-1">
              <div className="bg-slate-50 p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer font-semibold">
                    <input
                      type="radio"
                      name="stType"
                      checked={statementType === "ACCUMULATED"}
                      onChange={() => setStatementType("ACCUMULATED")}
                    />
                    Cộng dồn toàn bộ nợ tồn đến nay
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-semibold">
                    <input
                      type="radio"
                      name="stType"
                      checked={statementType === "MONTHLY"}
                      onChange={() => setStatementType("MONTHLY")}
                    />
                    Theo tháng
                  </label>
                </div>
                {statementType === "MONTHLY" && (
                  <input
                    type="month"
                    value={statementMonth}
                    onChange={(e) => setStatementMonth(e.target.value)}
                    className="border rounded px-2.5 py-1 text-xs bg-white font-semibold"
                  />
                )}
              </div>

              {/* Bảng Job & Hậu kỳ */}
              <div>
                <h4 className="font-bold text-slate-800 mb-2 uppercase">1. Job & Hậu kỳ hoàn thành (Đủ điều kiện thanh toán)</h4>
                <div className="border rounded-xl overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-100 text-slate-600 text-[11px] border-b">
                      <tr>
                        <th className="p-2.5">Ngày thực hiện</th>
                        <th className="p-2.5">Tên Job / Khách hàng</th>
                        <th className="p-2.5">Hạng mục / Vai trò</th>
                        <th className="p-2.5 text-center">Trạng thái</th>
                        <th className="p-2.5 text-right">Lương thực nhận</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {(statementEmployee.salaryJobs || []).map((j: any) => (
                        <tr key={j.id}>
                          <td className="p-2.5 whitespace-nowrap">{formatDateVN(j.job_days?.shooting_date)}</td>
                          <td className="p-2.5 font-medium">{j.jobs?.event_name || j.jobs?.customer_name}</td>
                          <td className="p-2.5">{j.role}</td>
                          <td className="p-2.5 text-center text-emerald-700 font-medium">Đã hoàn thành</td>
                          <td className="p-2.5 text-right font-bold text-blue-700">{formatMoney(j.salary_amount)}</td>
                        </tr>
                      ))}
                      {(statementEmployee.postJobs || []).map((p: any) => (
                        <tr key={p.id} className="bg-purple-50/40">
                          <td className="p-2.5 whitespace-nowrap">{formatDateVN(p.completed_at?.slice(0, 10))}</td>
                          <td className="p-2.5 font-medium">{p.jobs?.event_name || p.jobs?.customer_name}</td>
                          <td className="p-2.5 font-semibold text-purple-700">{p.type === "EDIT_VIDEO" ? "Hậu kỳ: Edit Video" : "Hậu kỳ: Photoshop"}</td>
                          <td className="p-2.5 text-center text-emerald-700 font-medium">Hoàn thành</td>
                          <td className="p-2.5 text-right font-bold text-purple-700">{formatMoney(p.actual_price || p.default_price)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 font-bold border-t">
                      <tr>
                        <td colSpan={4} className="p-2.5 text-right">Tổng công Job & Hậu kỳ:</td>
                        <td className="p-2.5 text-right text-blue-700">{formatMoney(statementEmployee.baseSalary)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Bảng ứng lương & Thưởng phạt */}
              <div>
                <h4 className="font-bold text-slate-800 mb-2 uppercase">2. Khoản đã tạm ứng & Thưởng / Khấu trừ</h4>
                <div className="border rounded-xl overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-100 text-slate-600 text-[11px] border-b">
                      <tr>
                        <th className="p-2.5">Ngày</th>
                        <th className="p-2.5">Loại giao dịch</th>
                        <th className="p-2.5">Ghi chú</th>
                        <th className="p-2.5 text-right">Số tiền</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredAdvances
                        .filter((a) => a.employee_id === statementEmployee.id)
                        .map((a) => (
                          <tr key={a.id}>
                            <td className="p-2.5">{formatDateVN(a.advance_date)}</td>
                            <td className="p-2.5 font-bold text-amber-600">Tạm ứng lương</td>
                            <td className="p-2.5">{a.note}</td>
                            <td className="p-2.5 text-right font-bold text-amber-600">-{formatMoney(a.amount)}</td>
                          </tr>
                        ))}
                      {(statementEmployee.employeeAdjustments || []).map((adj: any) => (
                        <tr key={adj.id}>
                          <td className="p-2.5">{formatDateVN(adj.adjustment_date)}</td>
                          <td className={`p-2.5 font-bold ${adj.amount < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                            {adj.amount < 0 ? "Trừ vi phạm" : "Thưởng"}
                          </td>
                          <td className="p-2.5">{adj.note}</td>
                          <td className={`p-2.5 text-right font-bold ${adj.amount < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                            {adj.amount > 0 ? "+" : ""}{formatMoney(adj.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Khung tổng kết số dư */}
              <div className="bg-slate-900 text-white p-4 rounded-xl flex flex-col sm:flex-row justify-between items-center gap-3">
                <div className="space-y-1 text-xs">
                  <p>(+) Tổng công Job & Hậu kỳ: <b>{formatMoney(statementEmployee.baseSalary)}</b></p>
                  <p>(-) Tiền ứng đối trừ: <b className="text-amber-400">-{formatMoney(statementEmployee.totalAdvance)}</b></p>
                  <p>(+/-) Thưởng phạt: <b>{formatMoney(statementEmployee.adjustmentTotal)}</b></p>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-slate-400 uppercase tracking-widest block font-medium">Thực tế còn phải thanh toán:</span>
                  <span className="text-2xl font-black text-emerald-400 block">{formatMoney(statementEmployee.remain)}</span>
                </div>
              </div>
            </div>

            {/* Footer modal */}
            <div className="sticky bottom-0 bg-white px-6 py-3 border-t rounded-b-2xl flex justify-between items-center">
              <span className="text-[11px] text-slate-400">Gửi sao kê lưu lịch sử vào hệ thống, thợ xem qua app cá nhân.</span>
              <div className="flex gap-2">
                <button onClick={() => setStatementEmployee(null)} className="px-4 py-2 border rounded-lg text-slate-700 font-semibold">
                  Đóng
                </button>
                <button
                  disabled={isSendingStatement}
                  onClick={handleConfirmSendStatement}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow disabled:opacity-50"
                >
                  {isSendingStatement ? "Đang gửi..." : "Xác nhận gửi sao kê"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal chỉnh sửa giao dịch */}
      {editingTxn && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <h2 className="text-xl font-bold">Sửa {editingTxn.type === "advance" ? "khoản ứng" : "thanh toán lương"}</h2>
            <div className="mt-4 space-y-3">
              <label className="block text-sm font-medium">
                Số tiền
                <MoneyInput className="mt-1 w-full rounded-xl border p-3" value={editingTxn.amount || 0} onChange={(v) => setEditingTxn({ ...editingTxn, amount: v })} />
              </label>
              <label className="block text-sm font-medium">
                Ngày
                <input
                  type="date"
                  className="mt-1 w-full rounded-xl border p-3"
                  value={editingTxn.type === "advance" ? editingTxn.advance_date : editingTxn.payment_date}
                  onChange={(e) => setEditingTxn({ ...editingTxn, [editingTxn.type === "advance" ? "advance_date" : "payment_date"]: e.target.value })}
                />
              </label>
              <label className="block text-sm font-medium">
                Ghi chú
                <input className="mt-1 w-full rounded-xl border p-3" value={editingTxn.note || ""} onChange={(e) => setEditingTxn({ ...editingTxn, note: e.target.value })} />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setEditingTxn(null)} className="rounded-xl border px-4 py-2">
                Hủy
              </button>
              <button onClick={saveTxnEdit} className="rounded-xl bg-blue-600 px-4 py-2 text-white">
                Cập nhật
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Thưởng / Phạt */}
      {showPenalty && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5">
            <h2 className="text-xl font-bold">{penaltyForm.adjustment_type === "bonus" ? "Thưởng nhân sự" : "Trừ lương do vi phạm"}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {penaltyForm.adjustment_type === "bonus" ? "Khoản thưởng sẽ cộng trực tiếp vào lương phải trả." : "Khoản này sẽ trừ trực tiếp vào lương phải trả của nhân sự."}
            </p>
            <div className="mt-4 space-y-3">
              <label className="block text-sm font-medium">
                Nhân sự
                <select className="mt-1 w-full rounded-xl border p-3" value={penaltyForm.employee_id} onChange={(e) => setPenaltyForm({ ...penaltyForm, employee_id: e.target.value })}>
                  <option value="">Chọn nhân sự</option>
                  {employees.map((e: any) => (
                    <option key={e.id} value={e.id}>{e.full_name}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium">
                {penaltyForm.adjustment_type === "bonus" ? "Số tiền thưởng" : "Số tiền trừ"}
                <MoneyInput className="mt-1 w-full rounded-xl border p-3" value={penaltyForm.amount || 0} onChange={(v) => setPenaltyForm({ ...penaltyForm, amount: v })} />
              </label>
              <label className="block text-sm font-medium">
                Ngày
                <input type="date" className="mt-1 w-full rounded-xl border p-3" value={penaltyForm.adjustment_date} onChange={(e) => setPenaltyForm({ ...penaltyForm, adjustment_date: e.target.value })} />
              </label>
              <label className="block text-sm font-medium">
                {penaltyForm.adjustment_type === "bonus" ? "Nội dung thưởng" : "Nội dung vi phạm"}
                <textarea
                  rows={3}
                  className="mt-1 w-full rounded-xl border p-3"
                  value={penaltyForm.note}
                  onChange={(e) => setPenaltyForm({ ...penaltyForm, note: e.target.value })}
                  placeholder={penaltyForm.adjustment_type === "bonus" ? "VD: Làm tốt, khách khen, hỗ trợ thêm..." : "VD: Đi muộn 30 phút, thiếu file, không đúng dresscode..."}
                />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowPenalty(false)} className="rounded-xl border px-4 py-2">
                Hủy
              </button>
              <button onClick={savePenalty} className={`rounded-xl px-4 py-2 text-white ${penaltyForm.adjustment_type === "bonus" ? "bg-emerald-600" : "bg-red-600"}`}>
                {penaltyForm.adjustment_type === "bonus" ? "Lưu thưởng" : "Lưu khấu trừ"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal chi tiết cũ */}
      {selectedEmployee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-5 sm:p-6 w-full max-w-4xl max-h-[85vh] overflow-auto">
            <h2 className="text-2xl font-bold mb-2">Chi tiết công việc: {selectedEmployee.full_name}</h2>
            <p className="mb-4 text-gray-500">{month === "ALL" ? "Tất cả thời gian (Lũy kế)" : `Tháng ${month}`}</p>

            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-5">
              <div className="border rounded p-3"><p className="text-xs text-gray-500">Lương Job</p><b>{formatMoney(selectedEmployee.baseSalary)}</b></div>
              <div className="border rounded p-3"><p className="text-xs text-gray-500">Phát sinh +/-</p><b className={selectedEmployee.adjustmentTotal < 0 ? "text-red-600" : "text-emerald-700"}>{selectedEmployee.adjustmentTotal >= 0 ? "+" : ""}{formatMoney(selectedEmployee.adjustmentTotal)}</b></div>
              <div className="border rounded p-3"><p className="text-xs text-gray-500">Lương sau phát sinh</p><b>{formatMoney(selectedEmployee.totalSalary)}</b></div>
              <div className="border rounded p-3"><p className="text-xs text-gray-500">Đã ứng</p><b className="text-orange-600">{formatMoney(selectedEmployee.totalAdvance)}</b></div>
              <div className="border rounded p-3"><p className="text-xs text-gray-500">Đã thanh toán</p><b className="text-green-600">{formatMoney(selectedEmployee.totalPaid)}</b></div>
              <div className="border rounded p-3"><p className="text-xs text-gray-500">Còn phải trả</p><b className="text-red-600">{formatMoney(selectedEmployee.remain)}</b></div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-xs">
                <thead>
                  <tr className="border-b bg-gray-50 text-slate-600">
                    <th className="text-left p-2">Ngày</th>
                    <th className="text-left p-2">Khách / sự kiện</th>
                    <th className="text-left p-2">Vai trò</th>
                    <th className="text-left p-2">Trạng thái</th>
                    <th className="text-left p-2">Địa điểm</th>
                    <th className="text-left p-2 text-right">Lương</th>
                    <th className="text-left p-2 text-right">Còn nợ Job</th>
                  </tr>
                </thead>
                <tbody>
                  {[...(selectedEmployee.salaryJobs || []), ...selectedEmployee.jobs.filter((j: any) => !assignmentCompleted(j))].map((job: any) => (
                    <tr key={job.id} className="border-b">
                      <td className="p-2">{formatDateVN(job.job_days?.shooting_date)}</td>
                      <td className="p-2 font-medium">{job.jobs?.event_name || job.jobs?.customer_name}</td>
                      <td className="p-2">{job.role}</td>
                      <td className="p-2">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${assignmentCompleted(job) ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                          {assignmentCompleted(job) ? "Đã xong" : (job.jobs?.status || "Chưa hoàn thành")}
                        </span>
                      </td>
                      <td className="p-2">{job.work_location_name}</td>
                      <td className="p-2 text-right font-bold">{formatMoney(job.salary_amount)}</td>
                      <td className="p-2 text-right">
                        {assignmentCompleted(job) ? (
                          <b className={Number(job.jobRemain || 0) > 0 ? "text-red-600" : "text-emerald-700"}>
                            {Number(job.jobRemain || 0) > 0 ? formatMoney(job.jobRemain) : "ĐÃ TRẢ ĐỦ"}
                          </b>
                        ) : (
                          <span className="text-slate-400">Job tương lai</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end mt-6">
              <button onClick={() => setSelectedEmployee(null)} className="border px-5 py-2 rounded text-slate-700 font-semibold hover:bg-slate-50">
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
