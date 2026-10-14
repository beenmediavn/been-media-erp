"use client";

import { useEffect, useMemo, useState } from "react";
import MainLayout from "../components/layout/MainLayout";
import { supabase } from "@/lib/supabase";
import MoneyInput from "../components/MoneyInput";
import { formatDateVN } from "@/lib/date-vn";
import Time24Input from "@/app/components/Time24Input";
import EmployeePicker from "@/app/components/EmployeePicker";
import { requireEditPin } from "@/lib/admin-pin";
import { getOfflineCache, getOfflineCount, setOfflineCache, subscribeOfflineQueue } from "@/lib/offline-db";
import { makeOfflineJobBundle, queueOfflineJob } from "@/lib/offline-job";

const money = (value: number | string | null | undefined) =>
  Number(value || 0).toLocaleString("vi-VN") + " đ";

const emptyCustomer = {
  customer_id: "",
  full_name: "",
  phone: "",
  secondary_phone: "",
  email: "",
  address: "",
  facebook: "",
};

const emptyJob = {
  event_name: "",
  booking_date: new Date().toISOString().slice(0, 10),
  service: "Combo VIP",
  total_price: 0,
  deposit: 0,
  status: "Đã đặt cọc",
  location: "",
  note: "",
  required_photo_count: 2,
  required_video_count: 1,
};

const makeAssignment = (role = "Thợ chụp") => ({
  employee_id: "",
  role,
  salary_amount: role === "Thợ quay" ? 900000 : role === "Flycam" ? 1200000 : role === "Editor" ? 500000 : 700000,
  note: "",
  client_requested: false,
  contact_visible: false,
});

const makeLocation = (name = "Nhà trai") => ({
  location_name: name,
  address: "",
  phone: "",
  note: "",
  assignments: [makeAssignment("Thợ chụp"), makeAssignment("Thợ quay")],
});

const makeDay = () => ({
  shooting_date: "",
  start_time: "07:00",
  end_time: "11:00",
  note: "",
  locations: [makeLocation("Nhà trai"), makeLocation("Nhà gái")],
});

const normalizePhone = (value: string | null | undefined) =>
  String(value || "").replace(/\D/g, "");

const getMainCustomer = (job: any) => job.customers || {};

const getFirstJobDay = (job: any) => (job.job_days || [])[0] || {};

export const isJobDoneActual = (job: any) => {
  const s = String(job?.status || "").trim().toLowerCase();
  if (s.includes("hoàn thành") || s.includes("đã bàn giao")) return true;
  const days = job?.job_days || [];
  if (!days.length) return false;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  
  return days.every((d: any) => {
    const dDate = String(d.shooting_date || "");
    if (!dDate) return false;
    if (dDate < today) return true;
    if (dDate > today) return false;
    const end = String(d.end_time || "").slice(0, 5);
    return end && end <= currentTime;
  });
};

export const getJobDetailedStatus = (job: any) => {
  const isDone = isJobDoneActual(job);
  const total = Number(job?.total_price || 0);
  const deposit = Number(job?.deposit || 0);
  const debt = Number(job?.debt ?? (total - deposit));
  const isPaid = total > 0 ? debt <= 0 : deposit > 0;

  if (isDone && isPaid) {
    return {
      label: "Hoàn thành - Đã thanh toán",
      badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300",
      isCompleted: true,
    };
  }
  if (isDone && !isPaid) {
    return {
      label: "Hoàn thành - Chưa thanh toán",
      badgeClass: "bg-amber-100 text-amber-800 border-amber-300",
      isCompleted: true,
    };
  }
  if (!isDone && isPaid) {
    return {
      label: "Đã thanh toán - Chưa hoàn thành",
      badgeClass: "bg-blue-100 text-blue-800 border-blue-300",
      isCompleted: false,
    };
  }
  return {
    label: job?.status || "Đã đặt cọc",
    badgeClass: "bg-slate-100 text-slate-700 border-slate-300",
    isCompleted: false,
  };
};

const timeToMinutes = (value: any) => { const m = String(value || "00:00").match(/^(\d{1,2}):(\d{2})/); return m ? Number(m[1]) * 60 + Number(m[2]) : 0; };
const timeOverlaps = (aStart: any, aEnd: any, bStart: any, bEnd: any) => timeToMinutes(aStart) < timeToMinutes(bEnd) && timeToMinutes(aEnd) > timeToMinutes(bStart);

export default function AdminJobPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [reserveWorkers, setReserveWorkers] = useState<any[]>([]);
  const [openForm, setOpenForm] = useState(false);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [editingJob, setEditingJob] = useState<any>(null);
  const [customerForm, setCustomerForm] = useState<any>(emptyCustomer);
  const [jobForm, setJobForm] = useState<any>(emptyJob);
  const [days, setDays] = useState<any[]>([makeDay()]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState<"all" | "completed" | "incomplete">("all");
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [filterMonth, setFilterMonth] = useState<"all" | number>("all");
  const [filterEmployee, setFilterEmployee] = useState("");

  const requestPin = async (action = "thao tác này") => {
    const { data } = await supabase.from("app_settings").select("value").eq("id", "edit_pin").maybeSingle();
    const pin = data?.value || "2580";
    const entered = window.prompt(`Nhập PIN để ${action}:`);
    if (entered === null) return false;
    if (entered !== pin) { alert("PIN không đúng"); return false; }
    return true;
  };

  const swapBrideGroomPhones = () => {
    const groom = customerForm.phone || "";
    const bride = customerForm.secondary_phone || "";
    setCustomerForm((prev: any) => ({ ...prev, phone: bride, secondary_phone: groom }));
  };

  async function loadData() {
    setLoading(true);
    const [{ data: jobData, error: jobError }, { data: customerData }, { data: empData }, { data: reserveData }] = await Promise.all([
      supabase
        .from("jobs")
        .select("*, customers(*), job_days(*, job_locations(*), job_assignments(*, employees(*)))")
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      supabase.from("customers").select("*").order("created_at", { ascending: false }),
      supabase.from("employees").select("*").eq("active", true).is("deleted_at", null).order("full_name", { ascending: true }),
      supabase.from("reserve_workers").select("*, employees(*)").eq("status", "reserved").order("reserve_date", { ascending: true }),
    ]);
    setLoading(false);

    if (jobError) {
      if (typeof navigator === "undefined" || navigator.onLine) alert(jobError.message);
      return;
    }

    setJobs(jobData || []);
    setCustomers(customerData || []);
    setEmployees(empData || []);
    setReserveWorkers(reserveData || []);
  }

  useEffect(() => {
    loadData();
  }, []);

  const openCreate = () => {
    setEditingJob(null);
    setCustomerForm({ ...emptyCustomer });
    setJobForm({ ...emptyJob });
    setDays([makeDay()]);
    setOpenForm(true);
  };

  const buildDaysFromJob = (job: any) => {
    const jobDays = job.job_days || [];
    if (jobDays.length === 0) return [makeDay()];
    return jobDays.map((day: any) => {
      const savedLocations = (day.job_locations || []).slice().sort((a: any, b: any) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
      const locations = savedLocations.map((loc: any) => ({
        location_name: loc.location_name || "Địa điểm",
        address: loc.address || "",
        phone: loc.phone || "",
        note: "",
        assignments: (day.job_assignments || []).filter((a: any) =>
          String(a.work_location_name || "") === String(loc.location_name || "") &&
          String(a.work_location_address || "") === String(loc.address || "")
        ).map((assignment: any) => ({
          employee_id: assignment.employee_id || "",
          role: assignment.role || "Thợ chụp",
          salary_amount: Number(assignment.salary_amount || 0),
          note: assignment.note || "",
          client_requested: Boolean(assignment.client_requested),
          contact_visible: Boolean(assignment.contact_visible),
        }))
      }));
      if (!locations.length) {
        const groups: any = {};
        (day.job_assignments || []).forEach((assignment: any) => {
          const key = [assignment.work_location_name || day.location || "Địa điểm", assignment.work_location_address || "", assignment.work_location_phone || ""].join("__");
          if (!groups[key]) groups[key] = { location_name: assignment.work_location_name || day.location || "Địa điểm", address: assignment.work_location_address || "", phone: assignment.work_location_phone || "", note: "", assignments: [] };
          groups[key].assignments.push({
            employee_id: assignment.employee_id || "",
            role: assignment.role || "Thợ chụp",
            salary_amount: Number(assignment.salary_amount || 0),
            note: assignment.note || "",
            client_requested: Boolean(assignment.client_requested),
            contact_visible: Boolean(assignment.contact_visible)
          });
        });
        locations.push(...Object.values(groups));
      }
      return {
        shooting_date: day.shooting_date || "",
        start_time: day.start_time || "07:00",
        end_time: day.end_time || "11:00",
        note: day.note || "",
        locations: locations.length ? locations : [makeLocation("Nhà trai"), makeLocation("Nhà gái")]
      };
    });
  };

  const openEdit = async (job: any) => {
    if (!(await requestPin("sửa Job"))) return;
    setEditingJob(job);

    setCustomerForm({
      customer_id: job.customer_id || job.customers?.id || "",
      full_name: job.customers?.full_name || job.customer_name || "",
      phone: job.customers?.phone || job.customer_phone || "",
      secondary_phone: job.customers?.secondary_phone || job.secondary_phone || "",
      email: job.customers?.email || "",
      address: job.customers?.address || "",
      facebook: job.customers?.facebook || "",
    });

    setJobForm({
      event_name: job.event_name || "",
      booking_date: job.booking_date || new Date().toISOString().slice(0, 10),
      service: job.service || "Combo VIP",
      total_price: Number(job.total_price || 0),
      deposit: Number(job.deposit || 0),
      status: job.status || "Đã đặt cọc",
      location: job.location || "",
      note: job.note || "",
      required_photo_count: Number(job.required_photo_count || 0),
      required_video_count: Number(job.required_video_count || 0),
    });

    setDays(buildDaysFromJob(job));
    setOpenForm(true);
  };

  const addDay = () => setDays((prev) => [...prev, makeDay()]);
  const duplicateDay = (dayIndex: number) => {
    setDays((prev) => {
      const source = prev[dayIndex];
      const copy = JSON.parse(JSON.stringify(source));
      copy.shooting_date = "";
      return [...prev.slice(0, dayIndex + 1), copy, ...prev.slice(dayIndex + 1)];
    });
  };
  const removeDay = (dayIndex: number) => {
    setDays((prev) => prev.length <= 1 ? prev : prev.filter((_, i) => i !== dayIndex));
  };

  const updateDay = (dayIndex: number, key: string, value: any) => {
    setDays((prev) => prev.map((day, i) => (i === dayIndex ? { ...day, [key]: value } : day)));
  };

  const addLocation = (dayIndex: number, name = "Nhà gái") => {
    setDays((prev) =>
      prev.map((day, i) =>
        i === dayIndex
          ? { ...day, locations: [...day.locations, makeLocation(name)] }
          : day
      )
    );
  };

  const updateLocation = (dayIndex: number, locationIndex: number, key: string, value: any) => {
    setDays((prev) =>
      prev.map((day, i) => {
        if (i !== dayIndex) return day;
        return {
          ...day,
          locations: day.locations.map((location: any, j: number) =>
            j === locationIndex ? { ...location, [key]: value } : location
          ),
        };
      })
    );
  };

  const removeLocation = (dayIndex: number, locationIndex: number) => {
    setDays((prev) =>
      prev.map((day, i) =>
        i === dayIndex
          ? { ...day, locations: day.locations.filter((_: any, j: number) => j !== locationIndex) }
          : day
      )
    );
  };

  const addAssignment = (dayIndex: number, locationIndex: number, role = "Thợ chụp") => {
    setDays((prev) =>
      prev.map((day, i) => {
        if (i !== dayIndex) return day;
        return {
          ...day,
          locations: day.locations.map((location: any, j: number) =>
            j === locationIndex
              ? { ...location, assignments: [...location.assignments, makeAssignment(role)] }
              : location
          ),
        };
      })
    );
  };

  const updateAssignment = (
    dayIndex: number,
    locationIndex: number,
    assignmentIndex: number,
    key: string,
    value: any
  ) => {
    setDays((prev) =>
      prev.map((day, i) => {
        if (i !== dayIndex) return day;
        return {
          ...day,
          locations: day.locations.map((location: any, j: number) => {
            if (j !== locationIndex) return location;
            return {
              ...location,
              assignments: location.assignments.map((assignment: any, k: number) =>
                k === assignmentIndex ? { ...assignment, [key]: value } : assignment
              ),
            };
          }),
        };
      })
    );
  };

  const removeAssignment = (dayIndex: number, locationIndex: number, assignmentIndex: number) => {
    setDays((prev) =>
      prev.map((day, i) => {
        if (i !== dayIndex) return day;
        return {
          ...day,
          locations: day.locations.map((location: any, j: number) =>
            j === locationIndex
              ? { ...location, assignments: location.assignments.filter((_: any, k: number) => k !== assignmentIndex) }
              : location
          ),
        };
      })
    );
  };

  async function saveJob() {
    if (saving) return;

    if (!customerForm.customer_id && !customerForm.full_name.trim()) {
      alert("Vui lòng chọn khách hàng hoặc nhập tên khách mới");
      return;
    }
    if (!jobForm.event_name.trim()) {
      alert("Vui lòng nhập tên sự kiện / tên dâu rể");
      return;
    }
    if (days.some((day) => !day.shooting_date)) {
      alert("Vui lòng nhập đầy đủ ngày chụp");
      return;
    }

    setSaving(true);
    try {
      let customerId = customerForm.customer_id;
      const total = Number(jobForm.total_price || 0);
      const deposit = Number(jobForm.deposit || 0);
      const debt = total - deposit;

      if (!customerId) {
        const { data: createdCustomer, error: customerError } = await supabase
          .from("customers")
          .insert([
            {
              customer_code: "KH" + Date.now(),
              full_name: customerForm.full_name,
              phone: customerForm.phone,
              secondary_phone: customerForm.secondary_phone,
              email: customerForm.email,
              address: customerForm.address,
              facebook: customerForm.facebook,
              service: jobForm.service,
              total_price: total,
              deposit,
              debt,
              status: jobForm.status,
              note: jobForm.note,
            },
          ])
          .select("id")
          .single();
        if (customerError) throw customerError;
        customerId = createdCustomer.id;
      }

      const jobPayload = {
        customer_id: customerId,
        customer_name: customerForm.full_name,
        customer_phone: customerForm.phone,
        secondary_phone: customerForm.secondary_phone,
        event_name: jobForm.event_name,
        booking_date: jobForm.booking_date || null,
        service: jobForm.service,
        total_price: total,
        deposit,
        debt,
        status: jobForm.status,
        location: jobForm.location,
        required_photo_count: Number(jobForm.required_photo_count || 0),
        required_video_count: Number(jobForm.required_video_count || 0),
        note: jobForm.note,
      };

      let jobId = editingJob?.id;

      if (editingJob) {
        const { error: updateJobError } = await supabase.from("jobs").update(jobPayload).eq("id", jobId);
        if (updateJobError) throw updateJobError;

        await supabase.from("job_days").delete().eq("job_id", jobId);
      } else {
        const { data: createdJob, error: jobError } = await supabase
          .from("jobs")
          .insert([{ job_code: "JOB" + Date.now(), ...jobPayload }])
          .select("id")
          .single();
        if (jobError) throw jobError;
        jobId = createdJob.id;

        if (deposit > 0) {
          await supabase.from("customer_payments").insert([
            { customer_id: customerId, job_id: jobId, amount: deposit, method: "Đặt cọc", note: "Tự tạo khi tạo job" },
          ]);
        }
      }

      for (const day of days) {
        const locationSummary = day.locations
          .map((loc: any) => `${loc.location_name}:${loc.address}`)
          .join(" | ");

        const { data: createdDay, error: dayError } = await supabase
          .from("job_days")
          .insert([
            {
              job_id: jobId,
              shooting_date: day.shooting_date,
              start_time: day.start_time,
              end_time: day.end_time,
              location: locationSummary || jobForm.location,
              note: day.note,
            },
          ])
          .select("id")
          .single();

        if (dayError) throw dayError;

        if (day.locations?.length) {
          await supabase.from("job_locations").insert(
            day.locations.map((location: any, sortIndex: number) => ({
              job_day_id: createdDay.id,
              location_name: location.location_name,
              address: location.address,
              phone: location.phone,
              sort_order: sortIndex,
            }))
          );
        }

        const assignmentRows = day.locations.flatMap((location: any) =>
          location.assignments
            .filter((assignment: any) => assignment.employee_id)
            .map((assignment: any) => ({
              job_id: jobId,
              job_day_id: createdDay.id,
              employee_id: assignment.employee_id,
              role: assignment.role,
              salary_amount: Number(assignment.salary_amount || 0),
              note: assignment.note,
              client_requested: Boolean(assignment.client_requested),
              contact_visible: Boolean(assignment.contact_visible),
              work_location_name: location.location_name,
              work_location_address: location.address,
              work_location_phone: location.phone,
            }))
        );

        if (assignmentRows.length > 0) {
          const { error: assignmentError } = await supabase.from("job_assignments").insert(assignmentRows);
          if (assignmentError) throw assignmentError;
        }
      }

      setOpenForm(false);
      setEditingJob(null);
      await loadData();
      alert("Đã lưu Job & phân công thành công!");
    } catch (error: any) {
      alert(error.message || "Lỗi lưu Job");
    } finally {
      setSaving(false);
    }
  }

  async function deleteJob(id: string) {
    if (!(await requestPin("xóa Job"))) return;
    if (!confirm("Chuyển Job này vào Thùng rác 30 ngày?")) return;
    const { error } = await supabase.from("jobs").update({ deleted_at: new Date().toISOString(), deleted_by: "Admin ERP" }).eq("id", id);
    if (error) return alert(error.message);
    setSelectedJob(null);
    loadData();
  }

  const periodJobs = useMemo(() => jobs.filter((job: any) => {
    const ds = (job.job_days || []).map((d: any) => String(d.shooting_date || ""));
    if (!ds.length) return filterMonth === "all";
    return ds.some((v: string) => Number(v.slice(0, 4)) === filterYear && (filterMonth === "all" || Number(v.slice(5, 7)) === filterMonth));
  }), [jobs, filterYear, filterMonth]);

  const filteredJobs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return periodJobs.filter((job: any) => {
      const isDone = isJobDoneActual(job);
      if (statusTab === "completed" && !isDone) return false;
      if (statusTab === "incomplete" && isDone) return false;

      const assigns = (job.job_days || []).flatMap((d: any) => d.job_assignments || []);
      if (filterEmployee && !assigns.some((a: any) => a.employee_id === filterEmployee)) return false;

      const text = [
        job.job_code,
        job.event_name,
        job.customer_name,
        job.customer_phone,
        job.service,
        ...assigns.map((a: any) => a.employees?.full_name)
      ].join(" ").toLowerCase();

      return !q || text.includes(q);
    });
  }, [periodJobs, statusTab, filterEmployee, search]);

  return (
    <MainLayout>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Job / Booking</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Quản lý lịch quay/chụp, ekip thợ và tự động nhận diện hoàn thành theo ngày/giờ
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={openCreate}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            + Tạo job mới
          </button>
        </div>
      </div>

      <div className="mb-5 rounded-2xl bg-white p-4 shadow-sm border">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border p-2.5 text-xs sm:text-sm"
            placeholder="Tìm tên khách, sự kiện, thợ..."
          />
          <select
            value={filterEmployee}
            onChange={(e) => setFilterEmployee(e.target.value)}
            className="w-full rounded-xl border p-2.5 text-xs sm:text-sm"
          >
            <option value="">Tất cả thợ</option>
            {employees.map((e: any) => (
              <option key={e.id} value={e.id}>{e.full_name}</option>
            ))}
          </select>
          <div className="flex gap-2 lg:col-span-2">
            {(
              [
                ["all", "Tất cả"],
                ["completed", "Đã xong"],
                ["incomplete", "Chưa xong"],
              ] as const
            ).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setStatusTab(k)}
                className={`flex-1 rounded-xl py-2.5 text-xs sm:text-sm font-bold ${
                  statusTab === k ? "bg-blue-600 text-white shadow-sm" : "border bg-white text-slate-700"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-xs">
            <thead className="border-b bg-slate-50 text-[11px] font-semibold uppercase text-slate-600">
              <tr>
                <th className="p-3.5">Mã job</th>
                <th className="p-3.5">Sự kiện</th>
                <th className="p-3.5">Khách hàng</th>
                <th className="p-3.5">Dịch vụ</th>
                <th className="p-3.5">Ngày chụp</th>
                <th className="p-3.5 text-right">Doanh thu</th>
                <th className="p-3.5 text-right">Còn nợ</th>
                <th className="p-3.5">Ekip</th>
                <th className="p-3.5 text-center">Trạng thái</th>
                <th className="p-3.5 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y text-slate-700">
              {filteredJobs.map((job) => {
                const statusInfo = getJobDetailedStatus(job);
                const debt = Number(job.debt ?? (Number(job.total_price || 0) - Number(job.deposit || 0)));

                return (
                  <tr key={job.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 font-bold text-slate-900">{job.job_code}</td>
                    <td className="p-3.5 font-bold text-slate-800">{job.event_name}</td>
                    <td className="p-3.5">
                      <div className="font-bold text-slate-800">{job.customers?.full_name || job.customer_name}</div>
                      <div className="text-[11px] text-slate-500">{job.customers?.phone || job.customer_phone}</div>
                    </td>
                    <td className="p-3.5 font-medium">{job.service}</td>
                    <td className="p-3.5 whitespace-nowrap">
                      {(job.job_days || []).map((d: any) => formatDateVN(d.shooting_date)).join(", ")}
                    </td>
                    <td className="p-3.5 text-right font-bold text-slate-800">{money(job.total_price)}</td>
                    <td className="p-3.5 text-right font-bold text-rose-600">{money(debt)}</td>
                    <td className="p-3.5">
                      <div className="flex max-w-[280px] flex-wrap gap-1">
                        {Array.from(
                          new Map(
                            (job.job_days || [])
                              .flatMap((d: any) => d.job_assignments || [])
                              .filter((a: any) => a.employee_id)
                              .map((a: any) => [a.employee_id, a])
                          ).values()
                        ).map((a: any) => (
                          <span
                            key={a.employee_id}
                            className={`rounded-full px-2 py-0.5 text-[11px] border ${
                              a.client_requested ? "bg-rose-50 text-rose-700 border-rose-200 font-bold" : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {a.client_requested ? "⭐ " : ""}{a.employees?.full_name} • {a.role}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-3.5 text-center">
                      <span className={`inline-block rounded-full border px-2.5 py-1 text-xs font-semibold ${statusInfo.badgeClass}`}>
                        {statusInfo.label}
                      </span>
                    </td>
                    <td className="p-3.5 text-center whitespace-nowrap space-x-1.5">
                      <button
                        onClick={() => setSelectedJob(job)}
                        className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-semibold text-white"
                      >
                        Xem
                      </button>
                      <button
                        onClick={() => openEdit(job)}
                        className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-semibold text-white"
                      >
                        Sửa
                      </button>
                      <button
                        onClick={() => deleteJob(job.id)}
                        className="rounded-lg bg-rose-600 px-3 py-1 text-xs font-semibold text-white"
                      >
                        Xóa
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {openForm && (
        <JobForm
          customers={customers}
          employees={employees}
          customerForm={customerForm}
          setCustomerForm={setCustomerForm}
          swapBrideGroomPhones={swapBrideGroomPhones}
          jobForm={jobForm}
          setJobForm={setJobForm}
          days={days}
          updateDay={updateDay}
          addDay={addDay}
          duplicateDay={duplicateDay}
          removeDay={removeDay}
          addLocation={addLocation}
          updateLocation={updateLocation}
          removeLocation={removeLocation}
          updateAssignment={updateAssignment}
          addAssignment={addAssignment}
          removeAssignment={removeAssignment}
          editingJob={editingJob}
          saving={saving}
          onClose={() => { setOpenForm(false); setEditingJob(null); }}
          onSave={saveJob}
        />
      )}

      {selectedJob && (
        <JobDetail
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          onEdit={() => { const j = selectedJob; setSelectedJob(null); openEdit(j); }}
          onDelete={() => deleteJob(selectedJob.id)}
        />
      )}
    </MainLayout>
  );
}

// FORM TẠO / SỬA JOB - ĐÚNG CHUẨN GIAO DIỆN CŨ (CÓ CHECKBOX CHỈ ĐỊNH ĐÍCH DANH & MỞ SĐT)
function JobForm(props: any) {
  const {
    customers,
    employees,
    customerForm,
    setCustomerForm,
    swapBrideGroomPhones,
    jobForm,
    setJobForm,
    days,
    updateDay,
    addDay,
    duplicateDay,
    removeDay,
    addLocation,
    updateLocation,
    removeLocation,
    updateAssignment,
    addAssignment,
    removeAssignment,
    editingJob,
    saving,
    onClose,
    onSave,
  } = props;

  // Tính toán cảnh báo thiếu thợ
  const allAssignments = days.flatMap((d: any) => d.locations || []).flatMap((l: any) => l.assignments || []);
  const currentPhoto = allAssignments.filter((a: any) => a.employee_id && a.role?.toLowerCase().includes("chụp")).length;
  const currentVideo = allAssignments.filter((a: any) => a.employee_id && a.role?.toLowerCase().includes("quay")).length;

  const reqPhoto = Number(jobForm.required_photo_count || 0);
  const reqVideo = Number(jobForm.required_video_count || 0);

  const missingPhoto = Math.max(reqPhoto - currentPhoto, 0);
  const missingVideo = Math.max(reqVideo - currentVideo, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-7xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[94vh]">
        {/* Header dính trên đầu */}
        <div className="sticky top-0 z-20 flex items-center justify-between border-b bg-white px-6 py-4 rounded-t-2xl">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-800">
              {editingJob ? "Sửa Job & Phân công" : "Tạo mới Job & Phân công"}
            </h2>
            <p className="text-xs text-slate-400">Thiết lập chi tiết dâu rể, phân chia thợ từng địa điểm</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 font-bold"
            title="Đóng (Esc)"
          >
            ✕
          </button>
        </div>

        {/* Nội dung Form cuộn */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-700 flex-1">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cột 1: Khách hàng */}
            <div className="border rounded-2xl p-4 space-y-3 bg-white">
              <h3 className="font-bold text-sm text-blue-700 uppercase">1. Thông tin Khách hàng</h3>
              <label className="block font-medium">
                Chọn khách hàng CRM
                <select
                  className="mt-1 border p-2.5 rounded-xl w-full"
                  value={customerForm.customer_id}
                  onChange={(e) => {
                    const customer = customers.find((c: any) => c.id === e.target.value);
                    setCustomerForm({
                      customer_id: e.target.value,
                      full_name: customer?.full_name || "",
                      phone: customer?.phone || "",
                      secondary_phone: customer?.secondary_phone || "",
                      email: customer?.email || "",
                      address: customer?.address || "",
                      facebook: customer?.facebook || customer?.full_name || "",
                    });
                  }}
                >
                  <option value="">Khách mới hoặc chọn từ CRM</option>
                  {customers.map((customer: any) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.full_name} - {customer.phone}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block font-medium">
                Tên khách đại diện / người book *
                <input
                  className="mt-1 border p-2.5 rounded-xl w-full"
                  placeholder="Ví dụ: Nguyễn Văn A"
                  value={customerForm.full_name}
                  onChange={(e) => setCustomerForm({ ...customerForm, full_name: e.target.value })}
                />
              </label>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
                <label className="font-medium">
                  SĐT chú rể / nhà trai *
                  <input
                    className="mt-1 border p-2.5 rounded-xl w-full"
                    placeholder="0912..."
                    value={customerForm.phone}
                    onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                  />
                </label>
                <button
                  type="button"
                  onClick={swapBrideGroomPhones}
                  className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs font-bold text-blue-700"
                >
                  ⇄ Đổi SĐT
                </button>
                <label className="font-medium">
                  SĐT cô dâu / nhà gái
                  <input
                    className="mt-1 border p-2.5 rounded-xl w-full"
                    placeholder="SĐT phụ..."
                    value={customerForm.secondary_phone}
                    onChange={(e) => setCustomerForm({ ...customerForm, secondary_phone: e.target.value })}
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <input
                  className="border p-2.5 rounded-xl"
                  placeholder="Email..."
                  value={customerForm.email}
                  onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                />
                <input
                  className="border p-2.5 rounded-xl"
                  placeholder="Facebook / Zalo..."
                  value={customerForm.facebook}
                  onChange={(e) => setCustomerForm({ ...customerForm, facebook: e.target.value })}
                />
              </div>
            </div>

            {/* Cột 2: Booking & Hợp đồng (CÓ Ô CHỌN SỐ LƯỢNG THỢ ĐỂ CẢNH BÁO) */}
            <div className="border rounded-2xl p-4 space-y-3 bg-white">
              <h3 className="font-bold text-sm text-blue-700 uppercase">2. Chi tiết Booking & Hợp đồng</h3>
              <input
                className="border p-2.5 rounded-xl w-full"
                placeholder="Tên sự kiện / tên dâu rể (VD: TUẤN BEEN & THU THỦY)"
                value={jobForm.event_name}
                onChange={(e) => setJobForm({ ...jobForm, event_name: e.target.value })}
              />

              <div className="grid grid-cols-2 gap-3">
                <label className="text-slate-600 font-medium">
                  Ngày đặt lịch
                  <input
                    type="date"
                    className="border p-2 rounded-xl w-full mt-1"
                    value={jobForm.booking_date}
                    onChange={(e) => setJobForm({ ...jobForm, booking_date: e.target.value })}
                  />
                </label>
                <label className="text-slate-600 font-medium">
                  Trạng thái
                  <select
                    className="border p-2 rounded-xl w-full mt-1 font-semibold"
                    value={jobForm.status}
                    onChange={(e) => setJobForm({ ...jobForm, status: e.target.value })}
                  >
                    <option>Đã đặt cọc</option>
                    <option>Đang chụp</option>
                    <option>Đang hậu kỳ</option>
                    <option>Đã bàn giao</option>
                    <option>Hoàn thành</option>
                    <option>Hủy</option>
                  </select>
                </label>
              </div>

              <input
                className="border p-2.5 rounded-xl w-full"
                placeholder="Gói dịch vụ (VD: Combo VIP - 2 chụp 1 quay)"
                value={jobForm.service}
                onChange={(e) => setJobForm({ ...jobForm, service: e.target.value })}
              />

              {/* Ô NHẬP SỐ LƯỢNG THỢ CHỤP / QUAY YÊU CẦU */}
              <div className="grid grid-cols-2 gap-3 bg-blue-50/50 p-2.5 rounded-xl border border-blue-100">
                <label className="font-semibold text-blue-900 text-xs">
                  📸 Số lượng thợ chụp yêu cầu:
                  <input
                    type="number"
                    min={0}
                    className="border p-2 rounded-lg w-full mt-1 bg-white font-bold text-center"
                    value={jobForm.required_photo_count ?? 0}
                    onChange={(e) => setJobForm({ ...jobForm, required_photo_count: Number(e.target.value) })}
                  />
                </label>
                <label className="font-semibold text-blue-900 text-xs">
                  🎥 Số lượng thợ quay yêu cầu:
                  <input
                    type="number"
                    min={0}
                    className="border p-2 rounded-lg w-full mt-1 bg-white font-bold text-center"
                    value={jobForm.required_video_count ?? 0}
                    onChange={(e) => setJobForm({ ...jobForm, required_video_count: Number(e.target.value) })}
                  />
                </label>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <label className="font-medium text-slate-700">
                  Tổng tiền
                  <MoneyInput
                    className="border p-2 rounded-xl w-full mt-1 font-bold"
                    value={jobForm.total_price}
                    onChange={(v) => setJobForm({ ...jobForm, total_price: v })}
                  />
                </label>
                <label className="font-medium text-slate-700">
                  Đã thu / Cọc
                  <MoneyInput
                    className="border p-2 rounded-xl w-full mt-1 font-bold text-emerald-600"
                    value={jobForm.deposit}
                    onChange={(v) => setJobForm({ ...jobForm, deposit: v })}
                  />
                </label>
                <label className="font-medium text-slate-700">
                  Còn nợ
                  <input
                    readOnly
                    className="border p-2 rounded-xl bg-slate-50 w-full mt-1 font-bold text-rose-600"
                    value={money(Number(jobForm.total_price || 0) - Number(jobForm.deposit || 0))}
                  />
                </label>
              </div>

              <textarea
                className="border p-2.5 rounded-xl w-full"
                placeholder="Ghi chú thêm về Job..."
                value={jobForm.note}
                onChange={(e) => setJobForm({ ...jobForm, note: e.target.value })}
              />
            </div>
          </div>

          {/* CẢNH BÁO THIẾU THỢ THEO YÊU CẦU */}
          {(missingPhoto > 0 || missingVideo > 0) && (
            <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-xs text-red-700 font-semibold flex items-center justify-between">
              <span>
                ⚠️ CẢNH BÁO THIẾU THỢ: 
                {missingPhoto > 0 && ` Thiếu ${missingPhoto} thợ chụp`}
                {missingPhoto > 0 && missingVideo > 0 && " • "}
                {missingVideo > 0 && ` Thiếu ${missingVideo} thợ quay`}
              </span>
              <span className="text-[11px] font-normal text-red-600">
                (Đã xếp: {currentPhoto}/{reqPhoto} chụp • {currentVideo}/{reqVideo} quay)
              </span>
            </div>
          )}

          {/* Mục 3: Ngày chụp → Địa điểm → Phân công thợ (CHUẨN GIAO DIỆN CŨ) */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-blue-700 uppercase">3. Ngày chụp → Địa điểm → Phân công thợ</h3>
              <button
                type="button"
                onClick={addDay}
                className="bg-slate-800 text-white px-3.5 py-1.5 rounded-xl font-semibold hover:bg-slate-900"
              >
                + Thêm ngày chụp
              </button>
            </div>

            {days.map((day: any, dayIndex: number) => (
              <div key={dayIndex} className="border rounded-2xl p-4 bg-slate-50 space-y-4 shadow-xs">
                {/* Header ngày */}
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="font-bold text-slate-800 text-sm">Ngày chụp {dayIndex + 1}</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => duplicateDay(dayIndex)}
                      className="rounded-lg border bg-white px-2.5 py-1 font-semibold text-blue-700 shadow-xs"
                    >
                      📋 Nhân đôi ngày
                    </button>
                    {days.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeDay(dayIndex)}
                        className="rounded-lg border bg-white px-2.5 py-1 font-semibold text-rose-600"
                      >
                        Xóa ngày
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <label className="font-medium text-slate-600">
                    Ngày thực hiện
                    <input
                      type="date"
                      className="border p-2 rounded-xl w-full mt-1 bg-white"
                      value={day.shooting_date}
                      onChange={(e) => updateDay(dayIndex, "shooting_date", e.target.value)}
                    />
                  </label>
                  <label className="font-medium text-slate-600">
                    Từ giờ
                    <Time24Input
                      className="border p-2 rounded-xl w-full mt-1 bg-white"
                      value={day.start_time}
                      onChange={(v) => updateDay(dayIndex, "start_time", v)}
                    />
                  </label>
                  <label className="font-medium text-slate-600">
                    Đến giờ
                    <Time24Input
                      className="border p-2 rounded-xl w-full mt-1 bg-white"
                      value={day.end_time}
                      onChange={(v) => updateDay(dayIndex, "end_time", v)}
                    />
                  </label>
                  <label className="font-medium text-slate-600">
                    Ghi chú ngày
                    <input
                      className="border p-2 rounded-xl w-full mt-1 bg-white"
                      value={day.note}
                      onChange={(e) => updateDay(dayIndex, "note", e.target.value)}
                      placeholder="Ăn hỏi / tiệc / lưu ý timeline..."
                    />
                  </label>
                </div>

                {/* Các địa điểm trong ngày này */}
                <div className="space-y-4 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700 text-xs uppercase">Các địa điểm trong ngày này</span>
                    <button
                      type="button"
                      onClick={() => addLocation(dayIndex, "Nhà gái")}
                      className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 shadow-sm"
                    >
                      + Thêm địa chỉ / nhà gái
                    </button>
                  </div>

                  {day.locations.map((loc: any, locIndex: number) => (
                    <div key={locIndex} className="rounded-2xl border bg-white p-4 space-y-3 shadow-xs">
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                        <div className="md:col-span-3">
                          <label className="text-[11px] font-semibold text-slate-500 block mb-1">Tên địa điểm / nhà</label>
                          <input
                            className="border p-2 rounded-xl w-full font-bold text-slate-800"
                            value={loc.location_name}
                            onChange={(e) => updateLocation(dayIndex, locIndex, "location_name", e.target.value)}
                            placeholder="Nhà trai / Nhà gái"
                          />
                        </div>
                        <div className="md:col-span-5">
                          <label className="text-[11px] font-semibold text-slate-500 block mb-1">Địa chỉ</label>
                          <input
                            className="border p-2 rounded-xl w-full"
                            value={loc.address}
                            onChange={(e) => updateLocation(dayIndex, locIndex, "address", e.target.value)}
                            placeholder="Xóm 1 Hoàng Xá / Giáp Long..."
                          />
                        </div>
                        <div className="md:col-span-3">
                          <label className="text-[11px] font-semibold text-slate-500 block mb-1">SĐT tại địa điểm</label>
                          <input
                            className="border p-2 rounded-xl w-full font-mono"
                            value={loc.phone}
                            onChange={(e) => updateLocation(dayIndex, locIndex, "phone", e.target.value)}
                            placeholder="0585557555"
                          />
                        </div>
                        <div className="md:col-span-1 flex justify-center pb-2">
                          <button
                            type="button"
                            onClick={() => removeLocation(dayIndex, locIndex)}
                            className="text-rose-600 font-bold text-base hover:text-rose-800"
                            title="Xóa địa điểm này"
                          >
                            ✕
                          </button>
                        </div>
                      </div>

                      {/* Nút thêm nhanh 4 vai trò */}
                      <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100">
                        <button
                          type="button"
                          onClick
