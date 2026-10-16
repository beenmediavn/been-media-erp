"use client";

import { useEffect, useMemo, useState } from "react";
import MainLayout from "../components/layout/MainLayout";
import { supabase } from "@/lib/supabase";
import MoneyInput from "../components/MoneyInput";
import { formatDateVN } from "@/lib/date-vn";
import Time24Input from "@/app/components/Time24Input";
import EmployeePicker from "@/app/components/EmployeePicker";
import { requireEditPin } from "@/lib/admin-pin";

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
  status: "Da dat coc",
  location: "",
  note: "",
  required_photo_count: "",
  required_video_count: "",
  video_editor_id: "",
  video_editor_salary: 0,
  photo_editor_id: "",
  photo_editor_salary: 0,
};

const makeAssignment = (role = "Tho chup") => ({
  employee_id: "",
  role,
  salary_amount: role === "Tho quay" ? 900000 : role === "Flycam" ? 1200000 : role === "Editor" ? 500000 : 700000,
  note: "",
  client_requested: false,
  contact_visible: true,
  reserve_worker_id: "",
});

const makeLocation = (name = "Nha trai", phone = "") => ({
  location_name: name,
  address: "",
  phone: phone,
  note: "",
  assignments: [makeAssignment("Tho chup"), makeAssignment("Tho quay")],
});

const makeDay = () => ({
  shooting_date: "",
  start_time: "07:00",
  end_time: "11:00",
  note: "",
  locations: [makeLocation("Nha trai"), makeLocation("Nha gai")],
});

const timeToMinutes = (value: any) => {
  const m = String(value || "00:00").match(/^(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
};
const timeOverlaps = (aStart: any, aEnd: any, bStart: any, bEnd: any) =>
  timeToMinutes(aStart) < timeToMinutes(bEnd) && timeToMinutes(aEnd) > timeToMinutes(bStart);

export const isJobDoneActual = (job: any) => {
  const s = String(job?.status || "").trim().toLowerCase();
  if (s.includes("hoan thanh") || s.includes("da ban giao")) return true;
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
  const total = Number(job?.total_price || 0) + Number(job?.extra_fee || 0);
  const deposit = Number(job?.deposit || 0);
  const debt = Number(job?.debt ?? (total - deposit));
  const isPaid = total > 0 ? debt <= 0 : deposit > 0;
  const isDone = isJobDoneActual(job) || isPaid;

  if (isPaid) {
    return {
      label: "Hoan thanh - Da thanh toan",
      badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300",
      isCompleted: true,
    };
  }
  if (isDone && !isPaid) {
    return {
      label: "Hoan thanh - Chua thanh toan",
      badgeClass: "bg-amber-100 text-amber-800 border-amber-300",
      isCompleted: true,
    };
  }
  return {
    label: job?.status || "Da dat coc",
    badgeClass: "bg-slate-100 text-slate-700 border-slate-300",
    isCompleted: false,
  };
};

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
  const [statusTab, setStatusTab] = useState<"all" | "completed" | "upcoming" | "incomplete" | "paid" | "unpaid">("all");
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [filterMonth, setFilterMonth] = useState<"all" | number>("all");
  const [filterEmployee, setFilterEmployee] = useState("");

  const requestPin = async (action = "thao tac nay") => {
    const { data } = await supabase.from("app_settings").select("value").eq("id", "edit_pin").maybeSingle();
    const pin = data?.value || "2580";
    const entered = window.prompt(`Nhap PIN de ${action}:`);
    if (entered === null) return false;
    if (entered !== pin) { alert("PIN khong dung"); return false; }
    return true;
  };

  const swapBrideGroomPhones = () => {
    const groom = customerForm.phone || "";
    const bride = customerForm.secondary_phone || "";
    setCustomerForm((prev: any) => ({ ...prev, phone: bride, secondary_phone: groom }));
    setDays((prev: any[]) =>
      prev.map((day: any) => ({
        ...day,
        locations: (day.locations || []).map((loc: any, idx: number) => {
          const n = String(loc.location_name || "").toLowerCase();
          if (n.includes("trai") || idx === 0) return { ...loc, phone: bride };
          if (n.includes("gai") || idx === 1) return { ...loc, phone: groom };
          return loc;
        }),
      }))
    );
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

  const getEmployeeConflict = (employeeId: string, dayIndex: number, locationIndex: number, assignmentIndex: number) => {
    if (!employeeId) return null;
    const currentDay = days[dayIndex];
    if (!currentDay?.shooting_date) return null;

    for (const job of jobs) {
      if (editingJob?.id && job.id === editingJob.id) continue;
      for (const jd of job.job_days || []) {
        if (jd.shooting_date !== currentDay.shooting_date) continue;
        if (!timeOverlaps(currentDay.start_time, currentDay.end_time, jd.start_time, jd.end_time)) continue;
        const hit = (jd.job_assignments || []).find((a: any) => a.employee_id === employeeId);
        if (hit) return { job: job.event_name || job.customer_name || "Job khac", start: jd.start_time, end: jd.end_time };
      }
    }

    for (let di = 0; di < days.length; di++) {
      const d = days[di];
      if (d.shooting_date !== currentDay.shooting_date || !timeOverlaps(currentDay.start_time, currentDay.end_time, d.start_time, d.end_time)) continue;
      for (let li = 0; li < (d.locations || []).length; li++) {
        for (let ai = 0; ai < (d.locations[li].assignments || []).length; ai++) {
          if (di === dayIndex && li === locationIndex && ai === assignmentIndex) continue;
          if (d.locations[li].assignments[ai].employee_id === employeeId) {
            return { job: "Phan cong khac trong Job nay", start: d.start_time, end: d.end_time };
          }
        }
      }
    }
    return null;
  };

  const buildDaysFromJob = (job: any) => {
    const jobDays = job.job_days || [];
    if (jobDays.length === 0) return [makeDay()];
    return jobDays.map((day: any) => {
      const savedLocations = (day.job_locations || []).slice().sort((a: any, b: any) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
      const locations = savedLocations.map((loc: any) => ({
        location_name: loc.location_name || "Dia diem",
        address: loc.address || "",
        phone: loc.phone || "",
        note: "",
        assignments: (day.job_assignments || []).filter((a: any) =>
          String(a.work_location_name || "") === String(loc.location_name || "") &&
          String(a.work_location_address || "") === String(loc.address || "")
        ).map((assignment: any) => ({
          employee_id: assignment.employee_id || "",
          role: assignment.role || "Tho chup",
          salary_amount: Number(assignment.salary_amount || 0),
          note: assignment.note || "",
          client_requested: Boolean(assignment.client_requested),
          contact_visible: assignment.contact_visible ?? true,
          reserve_worker_id: "",
        }))
      }));
      if (!locations.length) {
        const groups: any = {};
        (day.job_assignments || []).forEach((assignment: any) => {
          const key = [assignment.work_location_name || day.location || "Dia diem", assignment.work_location_address || "", assignment.work_location_phone || ""].join("__");
          if (!groups[key]) groups[key] = { location_name: assignment.work_location_name || day.location || "Dia diem", address: assignment.work_location_address || "", phone: assignment.work_location_phone || "", note: "", assignments: [] };
          groups[key].assignments.push({
            employee_id: assignment.employee_id || "",
            role: assignment.role || "Tho chup",
            salary_amount: Number(assignment.salary_amount || 0),
            note: assignment.note || "",
            client_requested: Boolean(assignment.client_requested),
            contact_visible: assignment.contact_visible ?? true,
            reserve_worker_id: "",
          });
        });
        locations.push(...Object.values(groups));
      }
      return {
        shooting_date: day.shooting_date || "",
        start_time: day.start_time || "07:00",
        end_time: day.end_time || "11:00",
        note: day.note || "",
        locations: locations.length ? locations : [makeLocation("Nha trai", job.customers?.phone || job.customer_phone || ""), makeLocation("Nha gai", job.customers?.secondary_phone || job.secondary_phone || "")]
      };
    });
  };

  const openEdit = (job: any) => {
    setEditingJob(job);

    setCustomerForm({
      customer_id: job.customer_id || job.customers?.id || "",
      full_name: job.customers?.full_name || job.customer_name || "",
      phone: job.customers?.phone || job.customer_phone || "",
      secondary_phone: job.customers?.secondary_phone || job.secondary_phone || "",
      email: job.customers?.email || "",
      address: job.customers?.address || "",
      facebook: job.customers?.facebook || job.customers?.full_name || job.customer_name || "",
    });

    setJobForm({
      event_name: job.event_name || "",
      booking_date: job.booking_date || new Date().toISOString().slice(0, 10),
      service: job.service || "Combo VIP",
      total_price: Number(job.total_price || 0) - Number(job.extra_fee || 0),
      deposit: Number(job.deposit || 0),
      status: job.status || "Da dat coc",
      location: job.location || "",
      note: job.note || "",
      required_photo_count: job.required_photo_count !== null && job.required_photo_count !== undefined ? String(job.required_photo_count) : "",
      required_video_count: job.required_video_count !== null && job.required_video_count !== undefined ? String(job.required_video_count) : "",
      video_editor_id: job.video_editor_id || "",
      video_editor_salary: Number(job.video_editor_salary || 0),
      photo_editor_id: job.photo_editor_id || "",
      photo_editor_salary: Number(job.photo_editor_salary || 0),
    });

    setDays(buildDaysFromJob(job));
    setOpenForm(true);
  };

  const openCreate = () => {
    setEditingJob(null);
    setCustomerForm({ ...emptyCustomer });
    setJobForm({ ...emptyJob, required_photo_count: "", required_video_count: "" });
    setDays([makeDay()]);
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

  const addLocation = (dayIndex: number, name = "Nha gai") => {
    setDays((prev) =>
      prev.map((day, i) => {
        if (i !== dayIndex) return day;
        const defaultPhone = name.toLowerCase().includes("gai") ? (customerForm.secondary_phone || "") : (customerForm.phone || "");
        return { ...day, locations: [...day.locations, makeLocation(name, defaultPhone)] };
      })
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

  const addAssignment = (dayIndex: number, locationIndex: number, role = "Tho chup") => {
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

  async function markUsedReserveWorkers(jobId: string, usedReserveIds: string[], usedEmployeeIds: string[], shootingDates: string[]) {
    try {
      if (usedReserveIds.length > 0) {
        await supabase
          .from("reserve_workers")
          .update({ status: "used", assigned_job_id: jobId, assigned_at: new Date().toISOString() })
          .in("id", usedReserveIds);
      }
      if (usedEmployeeIds.length > 0 && shootingDates.length > 0) {
        await supabase
          .from("reserve_workers")
          .update({ status: "used", assigned_job_id: jobId, assigned_at: new Date().toISOString() })
          .in("employee_id", usedEmployeeIds)
          .in("reserve_date", shootingDates);
      }
    } catch (e) {
      console.error("Loi cap nhat tho du phong:", e);
    }
  }

  async function saveJob() {
    if (saving) return;

    if (!customerForm.customer_id && !customerForm.full_name.trim()) {
      alert("Vui long chon khach hang hoac nhap ten khach moi");
      return;
    }
    if (!jobForm.event_name.trim()) {
      alert("Vui long nhap ten su kien / ten dau re");
      return;
    }
    if (days.some((day) => !day.shooting_date)) {
      alert("Vui long nhap day du ngay chup");
      return;
    }

    setSaving(true);
    try {
      let customerId = customerForm.customer_id;
      const total = Number(jobForm.total_price || 0) + Number(editingJob?.extra_fee || 0);
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

      const parsedPhotoCount = jobForm.required_photo_count === "" || jobForm.required_photo_count === null 
        ? 0 
        : Number(jobForm.required_photo_count);
      const parsedVideoCount = jobForm.required_video_count === "" || jobForm.required_video_count === null 
        ? 0 
        : Number(jobForm.required_video_count);

      let finalNote = jobForm.note || "";
      if (jobForm.video_editor_id) {
        const vEmp = employees.find((e) => e.id === jobForm.video_editor_id);
        finalNote += `\n[HAU KY] Edit Video: ${vEmp?.full_name || "Tho"} (Cong: ${money(jobForm.video_editor_salary)})`;
      }
      if (jobForm.photo_editor_id) {
        const pEmp = employees.find((e) => e.id === jobForm.photo_editor_id);
        finalNote += `\n[HAU KY] Chinh anh PTS: ${pEmp?.full_name || "Tho"} (Cong: ${money(jobForm.photo_editor_salary)})`;
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
        status: debt <= 0 ? "Hoan thanh" : jobForm.status,
        location: jobForm.location,
        required_photo_count: parsedPhotoCount,
        required_video_count: parsedVideoCount,
        video_editor_id: jobForm.video_editor_id || null,
        video_editor_salary: Number(jobForm.video_editor_salary || 0),
        photo_editor_id: jobForm.photo_editor_id || null,
        photo_editor_salary: Number(jobForm.photo_editor_salary || 0),
        note: finalNote.trim(),
      };

      let jobId = editingJob?.id;

      if (editingJob) {
        const { error: updateJobError } = await supabase.from("jobs").update(jobPayload).eq("id", jobId);
        if (updateJobError) throw updateJobError;

        await supabase.from("job_days").delete().eq("job_id", jobId);
      } else {
        const { data: createdJob, error: jobError } = await supabase
          .from("jobs")
          .insert([{ job_code: "JOB" + Date.now(), ...jobPayload, extra_fee: 0 }])
          .select("id")
          .single();
        if (jobError) throw jobError;
        jobId = createdJob.id;

        if (deposit > 0) {
          await supabase.from("customer_payments").insert([
            { customer_id: customerId, job_id: jobId, amount: deposit, method: "Dat coc", note: "Thanh toan lan 1" },
          ]);
        }
      }

      const usedReserveIds: string[] = [];
      const usedEmployeeIds: string[] = [];
      const shootingDates: string[] = [];

      for (const day of days) {
        if (day.shooting_date) shootingDates.push(day.shooting_date);

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
            .map((assignment: any) => {
              if (assignment.reserve_worker_id) usedReserveIds.push(assignment.reserve_worker_id);
              if (assignment.employee_id) usedEmployeeIds.push(assignment.employee_id);

              return {
                job_id: jobId,
                job_day_id: createdDay.id,
                employee_id: assignment.employee_id,
                role: assignment.role,
                salary_amount: Number(assignment.salary_amount || 0),
                note: assignment.note,
                client_requested: Boolean(assignment.client_requested),
                contact_visible: assignment.contact_visible ?? true,
                work_location_name: location.location_name,
                work_location_address: location.address,
                work_location_phone: location.phone,
              };
            })
        );

        if (assignmentRows.length > 0) {
          const { error: assignmentError } = await supabase.from("job_assignments").insert(assignmentRows);
          if (assignmentError) throw assignmentError;
        }
      }

      await markUsedReserveWorkers(jobId, usedReserveIds, usedEmployeeIds, shootingDates);

      setOpenForm(false);
      setEditingJob(null);
      await loadData();
      alert("Da luu Job thanh cong!");
    } catch (error: any) {
      alert(error.message || "Loi luu Job");
    } finally {
      setSaving(false);
    }
  }

  async function deleteJob(id: string) {
    if (!(await requestPin("xoa Job"))) return;
    if (!confirm("Chuyen Job nay vao Thung rac 30 ngay?")) return;
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
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    return periodJobs.filter((job: any) => {
      const isDone = isJobDoneActual(job);
      const daysArr = (job.job_days || []).map((d: any) => d.shooting_date).filter(Boolean);
      const hasFutureDate = daysArr.some((dDate: string) => dDate >= today);

      if (statusTab === "completed" && !isDone) return false;
      if (statusTab === "upcoming" && !hasFutureDate) return false;
      if (statusTab === "incomplete" && isDone) return false;

      const total = Number(job.total_price || 0) + Number(job.extra_fee || 0);
      const deposit = Number(job.deposit || 0);
      const debt = Number(job.debt ?? (total - deposit));
      const isPaid = total > 0 ? debt <= 0 : deposit > 0;

      if (statusTab === "paid" && !isPaid) return false;
      if (statusTab === "unpaid" && isPaid) return false;

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
            Quan ly lich quay/chup, thanh toan linh hoat, phat sinh va phan cong ekip
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={openCreate}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            + Tao job moi
          </button>
        </div>
      </div>

      <div className="mb-5 rounded-2xl bg-white p-4 shadow-sm border">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6 items-center">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border p-2.5 text-xs sm:text-sm placeholder:text-slate-300 placeholder:font-normal placeholder:italic"
            placeholder="Tim ten khach, su kien, tho..."
          />
          <select
            value={filterEmployee}
            onChange={(e) => setFilterEmployee(e.target.value)}
            className="w-full rounded-xl border p-2.5 text-xs sm:text-sm"
          >
            <option value="">Tat ca tho</option>
            {employees.map((e: any) => (
              <option key={e.id} value={e.id}>{e.full_name}</option>
            ))}
          </select>
          <div className="flex flex-wrap gap-1.5 lg:col-span-4">
            {(
              [
                ["all", "📋 Tat ca"],
                ["completed", "✅ Da xong"],
                ["upcoming", "🚀 Sap toi"],
                ["incomplete", "⏳ Chua xong"],
                ["paid", "💰 Da thanh toan"],
                ["unpaid", "⚠️ Chua thanh toan"],
              ] as const
            ).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setStatusTab(k)}
                className={`flex-1 min-w-[110px] rounded-xl py-2 px-2 text-xs font-bold transition-all ${
                  statusTab === k ? "bg-blue-600 text-white shadow-sm" : "border bg-white text-slate-700 hover:bg-slate-50"
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
                <th className="p-3.5">Ma job</th>
                <th className="p-3.5">Su kien</th>
                <th className="p-3.5">Khach hang</th>
                <th className="p-3.5">Dich vu</th>
                <th className="p-3.5">Ngay chup</th>
                <th className="p-3.5 text-right">Doanh thu</th>
                <th className="p-3.5 text-right">Con no</th>
                <th className="p-3.5">Ekip</th>
                <th className="p-3.5 text-center">Trang thai</th>
                <th className="p-3.5 text-center">Thao tac</th>
              </tr>
            </thead>
            <tbody className="divide-y text-slate-700">
              {filteredJobs.map((job) => {
                const statusInfo = getJobDetailedStatus(job);
                const total = Number(job.total_price || 0) + Number(job.extra_fee || 0);
                const deposit = Number(job.deposit || 0);
                const debt = Number(job.debt ?? (total - deposit));

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
                    <td className="p-3.5 text-right font-bold text-slate-800">{money(total)}</td>
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
                        Sua
                      </button>
                      <button
                        onClick={() => deleteJob(job.id)}
                        className="rounded-lg bg-rose-600 px-3 py-1 text-xs font-semibold text-white"
                      >
                        Xoa
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
          reserveWorkers={reserveWorkers}
          customerForm={customerForm}
          setCustomerForm={setCustomerForm}
          swapBrideGroomPhones={swapBrideGroomPhones}
          jobForm={jobForm}
          setJobForm={setJobForm}
          days={days}
          setDays={setDays}
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
          getEmployeeConflict={getEmployeeConflict}
          editingJob={editingJob}
          saving={saving}
          onClose={() => {
            setOpenForm(false);
            setEditingJob(null);
          }}
          onSave={saveJob}
        />
      )}

      {selectedJob && (
        <JobDetail
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          onEdit={() => { const j = selectedJob; setSelectedJob(null); openEdit(j); }}
          onDelete={() => deleteJob(selectedJob.id)}
          onReload={loadData}
        />
      )}
    </MainLayout>
  );
}

function JobForm(props: any) {
  const {
    customers,
    employees,
    reserveWorkers = [],
    customerForm,
    setCustomerForm,
    swapBrideGroomPhones,
    jobForm,
    setJobForm,
    days,
    setDays,
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
    getEmployeeConflict,
    editingJob,
    saving,
    onClose,
    onSave,
  } = props;

  const handleGroomPhoneChange = (newPhone: string) => {
    setCustomerForm((prev: any) => ({ ...prev, phone: newPhone }));
    setDays((prev: any[]) =>
      prev.map((day: any) => ({
        ...day,
        locations: (day.locations || []).map((loc: any, idx: number) => {
          const n = String(loc.location_name || "").toLowerCase();
          if (n.includes("trai") || idx === 0) return { ...loc, phone: newPhone };
          return loc;
        }),
      }))
    );
  };

  const handleBridePhoneChange = (newPhone: string) => {
    setCustomerForm((prev: any) => ({ ...prev, secondary_phone: newPhone }));
    setDays((prev: any[]) =>
      prev.map((day: any) => ({
        ...day,
        locations: (day.locations || []).map((loc: any, idx: number) => {
          const n = String(loc.location_name || "").toLowerCase();
          if (n.includes("gai") || idx === 1) return { ...loc, phone: newPhone };
          return loc;
        }),
      }))
    );
  };

  const assignedWorkersInThisJob = Array.from(
    new Map(
      days.flatMap((d: any) => d.locations || []).flatMap((l: any) => l.assignments || [])
        .filter((a: any) => a.employee_id)
        .map((a: any) => [a.employee_id, employees.find((e: any) => e.id === a.employee_id)])
    ).values()
  ).filter(Boolean);

  const totalCalc = Number(jobForm.total_price || 0);
  const depositCalc = Number(jobForm.deposit || 0);
  const debtCalc = totalCalc - depositCalc;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-7xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[94vh]">
        <div className="sticky top-0 z-20 flex items-center justify-between border-b bg-white px-6 py-4 rounded-t-2xl">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-800">
              {editingJob ? "Sua Job & Phan cong" : "Tao moi Job & Phan cong"}
            </h2>
            <p className="text-xs text-slate-400 font-normal">Thiet lap chi tiet dau re, hop dong, hau ky va phan chia tho</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 font-bold"
          >
            ✕
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-700 flex-1">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="border rounded-2xl p-4 space-y-3 bg-white">
              <h3 className="font-bold text-sm text-blue-700 uppercase">1. Thong tin Khach hang</h3>
              <label className="block font-medium">
                <span className="text-slate-600">Chon khach hang CRM</span>
                <select
                  className="mt-1 border p-2.5 rounded-xl w-full font-medium text-slate-800"
                  value={customerForm.customer_id}
                  onChange={(e) => {
                    const customer = customers.find((c: any) => c.id === e.target.value);
                    const pGroom = customer?.phone || "";
                    const pBride = customer?.secondary_phone || "";
                    const fullName = customer?.full_name || "";
                    setCustomerForm({
                      customer_id: e.target.value,
                      full_name: fullName,
                      phone: pGroom,
                      secondary_phone: pBride,
                      email: customer?.email || "",
                      address: customer?.address || "",
                      facebook: customer?.facebook || fullName,
                    });
                  }}
                >
                  <option value="">Khach moi hoac chon tu CRM</option>
                  {customers.map((customer: any) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.full_name} - {customer.phone}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block font-medium">
                <span className="text-slate-600">Ten khach dai dien / nguoi book *</span>
                <input
                  className="mt-1 border p-2.5 rounded-xl w-full font-semibold text-slate-900 placeholder:text-slate-300 text-xs"
                  placeholder="Vi du: Nguyen Van A"
                  value={customerForm.full_name}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCustomerForm({ ...customerForm, full_name: val, facebook: val });
                  }}
                />
              </label>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
                <label className="font-medium">
                  <span className="text-slate-600">SDT chu re / nha trai *</span>
                  <input
                    className="mt-1 border p-2.5 rounded-xl w-full font-mono text-slate-900 text-xs"
                    placeholder="0912..."
                    value={customerForm.phone}
                    onChange={(e) => handleGroomPhoneChange(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  onClick={swapBrideGroomPhones}
                  className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs font-bold text-blue-700"
                >
                  ⇄ Doi SDT
                </button>
                <label className="font-medium">
                  <span className="text-slate-600">SDT co dau / nha gai</span>
                  <input
                    className="mt-1 border p-2.5 rounded-xl w-full font-mono text-slate-900 text-xs"
                    placeholder="SDT phu..."
                    value={customerForm.secondary_phone}
                    onChange={(e) => handleBridePhoneChange(e.target.value)}
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <input
                  className="border p-2.5 rounded-xl text-slate-800 text-xs"
                  placeholder="Email..."
                  value={customerForm.email}
                  onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                />
                <input
                  className="border p-2.5 rounded-xl text-slate-800 text-xs"
                  placeholder="Facebook / Zalo..."
                  value={customerForm.facebook}
                  onChange={(e) => setCustomerForm({ ...customerForm, facebook: e.target.value })}
                />
              </div>
            </div>

            <div className="border rounded-2xl p-4 space-y-3 bg-white">
              <h3 className="font-bold text-sm text-blue-700 uppercase">2. Chi tiet Booking & Hop dong</h3>
              <input
                className="border p-2.5 rounded-xl w-full font-semibold text-slate-900 text-xs"
                placeholder="Ten su kien / ten dau re"
                value={jobForm.event_name}
                onChange={(e) => setJobForm({ ...jobForm, event_name: e.target.value })}
              />

              <div className="grid grid-cols-2 gap-3">
                <label className="text-slate-600 font-medium">
                  Ngay dat lich
                  <input
                    type="date"
                    className="border p-2 rounded-xl w-full mt-1 font-semibold text-slate-800"
                    value={jobForm.booking_date}
                    onChange={(e) => setJobForm({ ...jobForm, booking_date: e.target.value })}
                  />
                </label>
                <label className="text-slate-600 font-medium">
                  Trang thai
                  <select
                    className="border p-2 rounded-xl w-full mt-1 font-semibold text-slate-800"
                    value={jobForm.status}
                    onChange={(e) => setJobForm({ ...jobForm, status: e.target.value })}
                  >
                    <option>Da dat coc</option>
                    <option>Dang chup</option>
                    <option>Dang hau ky</option>
                    <option>Da ban giao</option>
                    <option>Hoan thanh</option>
                    <option>Huy</option>
                  </select>
                </label>
              </div>

              <input
                className="border p-2.5 rounded-xl w-full font-medium text-slate-800 text-xs"
                placeholder="Goi dich vu"
                value={jobForm.service}
                onChange={(e) => setJobForm({ ...jobForm, service: e.target.value })}
              />

              <div className="grid grid-cols-3 gap-3 bg-slate-50 p-2.5 rounded-xl border">
                <label className="font-medium text-slate-700">
                  Tong tien
                  <MoneyInput
                    className="border p-2 rounded-xl w-full mt-1 font-bold text-slate-900"
                    value={jobForm.total_price}
                    onChange={(v: number) => setJobForm({ ...jobForm, total_price: v })}
                  />
                </label>
                <label className="font-medium text-slate-700">
                  Da coc
                  <MoneyInput
                    className="border p-2 rounded-xl w-full mt-1 font-bold text-emerald-600"
                    value={jobForm.deposit}
                    onChange={(v: number) => setJobForm({ ...jobForm, deposit: v })}
                  />
                </label>
                <label className="font-medium text-slate-700">
                  Con lai
                  <input
                    readOnly
                    className="border p-2 rounded-xl bg-slate-100 w-full mt-1 font-bold text-rose-600 text-xs"
                    value={money(debtCalc)}
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-blue-700 uppercase">3. Ngay chup va Phan cong tho</h3>
              <button
                type="button"
                onClick={addDay}
                className="bg-slate-800 text-white px-3.5 py-1.5 rounded-xl font-semibold hover:bg-slate-900"
              >
                + Them ngay chup
              </button>
            </div>

            {days.map((day: any, dayIndex: number) => (
              <div key={dayIndex} className="border rounded-2xl p-4 bg-slate-50 space-y-4 shadow-xs">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="font-bold text-slate-800 text-sm">Ngay chup {dayIndex + 1}</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => duplicateDay(dayIndex)}
                      className="rounded-lg border bg-white px-2.5 py-1 font-semibold text-blue-700 shadow-xs"
                    >
                      Nhan doi ngay
                    </button>
                    {days.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeDay(dayIndex)}
                        className="rounded-lg border bg-white px-2.5 py-1 font-semibold text-rose-600"
                      >
                        Xoa ngay
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <label className="font-medium text-slate-600">
                    Ngay thuc hien
                    <input
                      type="date"
                      className="border p-2 rounded-xl w-full mt-1 bg-white font-semibold text-slate-800"
                      value={day.shooting_date}
                      onChange={(e) => updateDay(dayIndex, "shooting_date", e.target.value)}
                    />
                  </label>
                  <label className="font-medium text-slate-600">
                    Tu gio
                    <Time24Input
                      className="border p-2 rounded-xl w-full mt-1 bg-white font-semibold text-slate-800"
                      value={day.start_time}
                      onChange={(v) => updateDay(dayIndex, "start_time", v)}
                    />
                  </label>
                  <label className="font-medium text-slate-600">
                    Den gio
                    <Time24Input
                      className="border p-2 rounded-xl w-full mt-1 bg-white font-semibold text-slate-800"
                      value={day.end_time}
                      onChange={(v) => updateDay(dayIndex, "end_time", v)}
                    />
                  </label>
                  <label className="font-medium text-slate-600">
                    Ghi chu ngay
                    <input
                      className="border p-2 rounded-xl w-full mt-1 bg-white font-medium text-slate-800 text-xs"
                      value={day.note}
                      onChange={(e) => updateDay(dayIndex, "note", e.target.value)}
                      placeholder="An hoi / tiec..."
                    />
                  </label>
                </div>

                <div className="space-y-4 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700 text-xs uppercase">Cac dia diem trong ngay nay</span>
                    <button
                      type="button"
                      onClick={() => addLocation(dayIndex, "Nha gai")}
                      className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 shadow-sm"
                    >
                      + Them dia chi / nha gai
                    </button>
                  </div>

                  {day.locations.map((loc: any, locIndex: number) => (
                    <div key={locIndex} className="rounded-2xl border bg-white p-4 space-y-3 shadow-xs">
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                        <div className="md:col-span-3">
                          <label className="text-[11px] font-semibold text-slate-500 block mb-1">Ten dia diem / nha</label>
                          <input
                            className="border p-2 rounded-xl w-full font-bold text-slate-800 text-xs"
                            value={loc.location_name}
                            onChange={(e) => updateLocation(dayIndex, locIndex, "location_name", e.target.value)}
                            placeholder="Nha trai / Nha gai"
                          />
                        </div>
                        <div className="md:col-span-5">
                          <label className="text-[11px] font-semibold text-slate-500 block mb-1">Dia chi</label>
                          <input
                            className="border p-2 rounded-xl w-full font-medium text-slate-800 text-xs"
                            value={loc.address}
                            onChange={(e) => updateLocation(dayIndex, locIndex, "address", e.target.value)}
                            placeholder="Dia chi..."
                          />
                        </div>
                        <div className="md:col-span-3">
                          <label className="text-[11px] font-semibold text-slate-500 block mb-1">SDT tai dia diem</label>
                          <input
                            className="border p-2 rounded-xl w-full font-mono text-slate-800 text-xs"
                            value={loc.phone}
                            onChange={(e) => updateLocation(dayIndex, locIndex, "phone", e.target.value)}
                            placeholder="SDT..."
                          />
                        </div>
                        <div className="md:col-span-1 flex justify-center pb-2">
                          <button
                            type="button"
                            onClick={() => removeLocation(dayIndex, locIndex)}
                            className="text-rose-600 font-bold text-base hover:text-rose-800"
                          >
                            ✕
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100">
                        {["Tho chup", "Tho quay", "Flycam", "Editor"].map((roleName) => (
                          <button
                            key={roleName}
                            type="button"
                            onClick={() => addAssignment(dayIndex, locIndex, roleName)}
                            className="rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
                          >
                            + {roleName}
                          </button>
                        ))}
                      </div>

                      <div className="space-y-3 pt-2">
                        {loc.assignments.map((assignment: any, assIndex: number) => (
                          <div key={assIndex} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-2">
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end">
                              <div className="md:col-span-2">
                                <label className="text-[11px] text-slate-500 font-medium block mb-1">Vai tro</label>
                                <select
                                  className="border p-2 rounded-lg font-medium text-xs bg-white w-full text-slate-800"
                                  value={assignment.role}
                                  onChange={(e) => updateAssignment(dayIndex, locIndex, assIndex, "role", e.target.value)}
                                >
                                  <option>Tho chup</option>
                                  <option>Tho quay</option>
                                  <option>Flycam</option>
                                  <option>Editor</option>
                                </select>
                              </div>

                              <div className="md:col-span-4">
                                <label className="text-[11px] font-semibold text-slate-500 block mb-1">Nhan su</label>
                                <EmployeePicker
                                  employees={employees}
                                  value={assignment.employee_id}
                                  getConflict={(id: string) => getEmployeeConflict(id, dayIndex, locIndex, assIndex)}
                                  onChange={(id: string) => {
                                    const selectedEmp = employees.find((e: any) => e.id === id);
                                    const autoSalary = Number(selectedEmp?.base_fee || 0) > 0 ? Number(selectedEmp.base_fee) : assignment.salary_amount;
                                    updateAssignment(dayIndex, locIndex, assIndex, "employee_id", id);
                                    if (Number(selectedEmp?.base_fee || 0) > 0) {
                                      updateAssignment(dayIndex, locIndex, assIndex, "salary_amount", autoSalary);
                                    }
                                  }}
                                />
                              </div>

                              <div className="md:col-span-2">
                                <label className="text-[11px] font-semibold text-slate-500 block mb-1">Luong tho</label>
                                <MoneyInput
                                  className="border p-2 rounded-lg w-full bg-white font-bold text-slate-800"
                                  value={assignment.salary_amount}
                                  onChange={(v: number) => updateAssignment(dayIndex, locIndex, assIndex, "salary_amount", v)}
                                />
                              </div>

                              <div className="md:col-span-3">
                                <label className="text-[11px] font-semibold text-slate-500 block mb-1">Ghi chu</label>
                                <input
                                  className="border p-2 rounded-lg w-full bg-white text-xs font-medium text-slate-800"
                                  value={assignment.note}
                                  onChange={(e) => updateAssignment(dayIndex, locIndex, assIndex, "note", e.target.value)}
                                  placeholder="Ghi chu..."
                                />
                              </div>

                              <div className="md:col-span-1 flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => removeAssignment(dayIndex, locIndex, assIndex)}
                                  className="border border-rose-300 text-rose-600 hover:bg-rose-50 px-3 py-2 rounded-lg font-semibold text-xs w-full text-center"
                                >
                                  Xoa
                                </button>
                              </div>
                            </div>

                            <div className="pt-2 border-t border-slate-200/60 flex flex-wrap gap-4 items-center">
                              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-amber-700">
                                <input
                                  type="checkbox"
                                  checked={Boolean(assignment.client_requested)}
                                  onChange={(e) => updateAssignment(dayIndex, locIndex, assIndex, "client_requested", e.target.checked)}
                                  className="rounded border-amber-300 text-amber-600"
                                />
                                <span>⭐ Khach chi dinh tho</span>
                              </label>

                              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-blue-700 bg-blue-50 px-3 py-1 rounded-lg border border-blue-200">
                                <input
                                  type="checkbox"
                                  checked={assignment.contact_visible ?? true}
                                  onChange={(e) => updateAssignment(dayIndex, locIndex, assIndex, "contact_visible", e.target.checked)}
                                  className="rounded border-blue-400 text-blue-600"
                                />
                                <span>📞 Bat mo som SDT</span>
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="border rounded-2xl p-4 bg-purple-50/40 border-purple-200 space-y-3">
            <div className="border-b border-purple-200 pb-2">
              <h3 className="font-bold text-sm text-purple-900 uppercase">4. Phan cong hau ky</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-3.5 rounded-xl border border-purple-100 space-y-2">
                <span className="font-bold text-slate-800 text-xs block">🎬 Tho Edit Video:</span>
                <select
                  className="w-full border p-2 rounded-lg text-xs bg-white font-medium text-slate-800"
                  value={jobForm.video_editor_id || ""}
                  onChange={(e) => {
                    const empId = e.target.value;
                    const selectedEmp = employees.find((emp: any) => emp.id === empId);
                    setJobForm({
                      ...jobForm,
                      video_editor_id: empId,
                      video_editor_salary: Number(selectedEmp?.base_fee || 0) > 0 ? Number(selectedEmp.base_fee) : (jobForm.video_editor_salary || 500000)
                    });
                  }}
                >
                  <option value="">-- Chon tho --</option>
                  {employees.map((emp: any) => (
                    <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                  ))}
                </select>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 text-xs whitespace-nowrap">Luong Edit:</span>
                  <MoneyInput
                    className="border p-1.5 rounded-lg w-full bg-white font-bold text-purple-700"
                    value={jobForm.video_editor_salary}
                    onChange={(v: number) => setJobForm({ ...jobForm, video_editor_salary: v })}
                  />
                </div>
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-purple-100 space-y-2">
                <span className="font-bold text-slate-800 text-xs block">🎨 Tho PTS:</span>
                <select
                  className="w-full border p-2 rounded-lg text-xs bg-white font-medium text-slate-800"
                  value={jobForm.photo_editor_id || ""}
                  onChange={(e) => {
                    const empId = e.target.value;
                    const selectedEmp = employees.find((emp: any) => emp.id === empId);
                    setJobForm({
                      ...jobForm,
                      photo_editor_id: empId,
                      photo_editor_salary: Number(selectedEmp?.base_fee || 0) > 0 ? Number(selectedEmp.base_fee) : (jobForm.photo_editor_salary || 300000)
                    });
                  }}
                >
                  <option value="">-- Chon tho --</option>
                  {employees.map((emp: any) => (
                    <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                  ))}
                </select>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 text-xs whitespace-nowrap">Luong PTS:</span>
                  <MoneyInput
                    className="border p-1.5 rounded-lg w-full bg-white font-bold text-blue-700"
                    value={jobForm.photo_editor_salary}
                    onChange={(v: number) => setJobForm({ ...jobForm, photo_editor_salary: v })}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 z-20 flex justify-end gap-2 border-t bg-white px-6 py-4 rounded-b-2xl">
          <button type="button" onClick={onClose} className="rounded-xl border px-4 py-2 font-semibold hover:bg-slate-50">Huy</button>
          <button type="button" onClick={onSave} disabled={saving} className="rounded-xl bg-blue-600 px-5 py-2 font-semibold text-white hover:bg-blue-700">
            {saving ? "Dang luu..." : editingJob ? "Cap nhat job" : "Luu job"}
          </button>
        </div>
      </div>
    </div>
  );
}

function JobDetail({ job, onClose, onEdit, onDelete, onReload }: any) {
  const days = job.job_days || [];
  const statusInfo = getJobDetailedStatus(job);
  const total = Number(job.total_price || 0) + Number(job.extra_fee || 0);
  const deposit = Number(job.deposit || 0);
  const debt = total - deposit;

  const [showPayModal, setShowPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState(debt > 0 ? debt : 0);
  const [payNote, setPayNote] = useState("Thanh toan bo sung");

  const [showExtraModal, setShowExtraModal] = useState(false);
  const [extraAmount, setExtraAmount] = useState(0);
  const [extraNote, setExtraNote] = useState("");

  const handlePayMore = async () => {
    if (payAmount <= 0) return alert("Vui long nhap so tien thanh toan");
    const newDeposit = deposit + Number(payAmount);
    const newDebt = total - newDeposit;

    const { error } = await supabase.from("jobs").update({
      deposit: newDeposit,
      debt: newDebt,
      status: newDebt <= 0 ? "Hoan thanh" : job.status
    }).eq("id", job.id);

    if (error) return alert(error.message);

    await supabase.from("customer_payments").insert([
      { customer_id: job.customer_id, job_id: job.id, amount: payAmount, method: "Tien mat/Chuyen khoan", note: payNote }
    ]);

    alert("Ghi nhan thanh toan thanh cong!");
    setShowPayModal(false);
    onReload();
  };

  const handleAddExtraFee = async () => {
    if (extraAmount <= 0) return alert("Vui long nhap so tien phat sinh");
    const currentExtra = Number(job.extra_fee || 0);
    const newExtra = currentExtra + Number(extraAmount);
    const newTotal = Number(job.total_price || 0) - currentExtra + newExtra;
    const newDebt = newTotal - deposit;

    const updatedNote = (job.note || "") + `\n[PHAT SINH] ${extraNote}: +${money(extraAmount)}`;

    const { error } = await supabase.from("jobs").update({
      total_price: newTotal,
      extra_fee: newExtra,
      debt: newDebt,
      note: updatedNote.trim(),
    }).eq("id", job.id);

    if (error) return alert(error.message);

    alert("Da them khoan phat sinh thanh cong!");
    setShowExtraModal(false);
    setExtraAmount(0);
    setExtraNote("");
    onReload();
  };

  const copySingleDay = (day: any, dayIndex: number) => {
    const groomPhone = job.customers?.phone || job.customer_phone || "Chua co";
    const bridePhone = job.customers?.secondary_phone || job.secondary_phone || "Chua co";

    const locGroom = (day.job_locations || []).find((l: any) => String(l.location_name || "").toLowerCase().includes("trai")) || {};
    const locBride = (day.job_locations || []).find((l: any) => String(l.location_name || "").toLowerCase().includes("gai")) || {};

    const groomAddr = locGroom.address || job.customers?.address || "Chua cap nhat";
    const brideAddr = locBride.address || "Chua cap nhat";

    let text = `📸 [BEEN MEDIA] - THONG TIN JOB\n`;
    text += `Su kien: ${job.event_name || job.customer_name || ""}\n`;
    text += `Ma Job: ${job.job_code}\n`;
    text += `Khach hang: ${job.customers?.full_name || job.customer_name || ""}\n`;
    text += `SDT Nha trai: ${groomPhone}\n`;
    text += `SDT Nha gai: ${bridePhone}\n`;
    text += `----------------------------------------\n`;
    text += `📅 Ngay ${dayIndex + 1}${day.note ? ` – ${day.note}` : ""}: ${formatDateVN(day.shooting_date)} • ${day.start_time?.slice(0, 5)} - ${day.end_time?.slice(0, 5)}\n`;
    text += `📍 Dia diem:\n`;
    text += `- Nha trai: ${groomAddr} (SDT: ${groomPhone})\n`;
    text += `- Nha gai: ${brideAddr} (SDT: ${bridePhone})\n\n`;
    text += `👥 Phan cong tho & Dia diem:\n`;

    const dayAssignments = day.job_assignments || [];
    if (dayAssignments.length > 0) {
      dayAssignments.forEach((a: any) => {
        const placeName = a.work_location_name || "Nha trai";
        text += `- ${a.role || "Tho"}: ${a.employees?.full_name || "Chua chon"} | Phu trach: ${placeName} | Luong: ${money(a.salary_amount)}\n`;
      });
    } else {
      text += `(Chua phan cong tho cho ngay nay)\n`;
    }

    navigator.clipboard.writeText(text);
    alert(`Da sao chep lich chup Ngay ${dayIndex + 1}!`);
  };

  const copyFullJob = async () => {
    const groomPhone = job.customers?.phone || job.customer_phone || "Chua co";
    const bridePhone = job.customers?.secondary_phone || job.secondary_phone || "Chua co";
    const eventName = job.event_name || job.customer_name || "";
    const customerName = job.customers?.full_name || job.customer_name || "";

    const lines: string[] = [
      `📸 [BEEN MEDIA] - THONG TIN JOB`,
      `Su kien: ${eventName}`,
      `Ma Job: ${job.job_code}`,
      `Dich vu: ${job.service || ""}`,
      `Khach hang: ${customerName}`,
      `SDT Nha trai: ${groomPhone}`,
      `SDT Nha gai: ${bridePhone}`,
      `Tong tien: ${money(total)} | Da coc: ${money(deposit)} | Con no: ${money(debt)}`,
      `----------------------------------------`,
    ];

    days.forEach((d: any, i: number) => {
      const locGroom = (d.job_locations || []).find((l: any) => String(l.location_name || "").toLowerCase().includes("trai")) || {};
      const locBride = (d.job_locations || []).find((l: any) => String(l.location_name || "").toLowerCase().includes("gai")) || {};

      const groomAddr = locGroom.address || job.customers?.address || "Chua cap nhat";
      const brideAddr = locBride.address || "Chua cap nhat";

      lines.push(
        `\n📅 Ngay ${i + 1}${d.note ? ` – ${d.note}` : ""}: ${formatDateVN(d.shooting_date)} • ${d.start_time?.slice(0, 5)} - ${d.end_time?.slice(0, 5)}`,
        `📍 Dia diem:`,
        `- Nha trai: ${groomAddr} (SDT: ${groomPhone})`,
        `- Nha gai: ${brideAddr} (SDT: ${bridePhone})`,
        `👥 Phan cong tho & Dia diem:`
      );

      const dAssignments = d.job_assignments || [];
      if (dAssignments.length > 0) {
        dAssignments.forEach((a: any) => {
          const placeName = a.work_location_name || "Nha trai";
          lines.push(`- ${a.role || "Tho"}: ${a.employees?.full_name || "Chua chon"} | Phu trach: ${placeName} | Luong: ${money(a.salary_amount)}`);
        });
      } else {
        lines.push(`(Chua phan cong tho cho ngay nay)`);
      }
    });

    await navigator.clipboard.writeText(lines.join("\n"));
    alert("Da sao chep day du Job tong kem phan cong chi tiet tat ca cac ngay!");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[92vh]">
        <div className="sticky top-0 z-25 flex items-center justify-between border-b bg-white px-6 py-4 rounded-t-2xl">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800">
              {job.event_name || job.job_code}
            </h2>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500">
              <span className="font-mono">{job.job_code}</span>
              <span>•</span>
              <span className="font-semibold text-slate-700">{job.customers?.full_name || job.customer_name}</span>
              <span>•</span>
              <span>{job.service}</span>
              <span>•</span>
              <span className={`rounded px-2 py-0.5 font-bold ${statusInfo.badgeClass}`}>
                {statusInfo.label}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 font-bold"
          >
            ✕
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-700 flex-1">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="rounded-xl border p-3 bg-white shadow-xs">
              <p className="text-slate-500">Tong tien</p>
              <p className="text-base font-black text-slate-800 mt-1">{money(total)}</p>
            </div>
            <div className="rounded-xl border p-3 bg-emerald-50/50 shadow-xs">
              <p className="text-slate-500">Da coc</p>
              <p className="text-base font-black text-emerald-600 mt-1">{money(deposit)}</p>
            </div>
            <div className="rounded-xl border p-3 bg-rose-50/50 shadow-xs">
              <p className="text-slate-500">Con lai</p>
              <p className="text-base font-black text-rose-600 mt-1">{money(debt)}</p>
            </div>
            <div className="rounded-xl border p-3 bg-white shadow-xs flex flex-col justify-between">
              <p className="text-slate-500">Thanh toan them</p>
              <button
                onClick={() => setShowPayModal(true)}
                className="mt-1 bg-emerald-600 hover:bg-emerald-700 text-white py-1.5 px-3 rounded-lg font-bold text-xs shadow-xs"
              >
                + Thu tien
              </button>
            </div>
            <div className="rounded-xl border p-3 bg-white shadow-xs flex flex-col justify-between">
              <p className="text-slate-500">Phat sinh</p>
              <button
                onClick={() => setShowExtraModal(true)}
                className="mt-1 bg-amber-600 hover:bg-amber-700 text-white py-1.5 px-3 rounded-lg font-bold text-xs shadow-xs"
              >
                + Them phat sinh
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {days.map((day: any, index: number) => {
              const locGroom = (day.job_locations || []).find((l: any) => String(l.location_name || "").toLowerCase().includes("trai")) || {};
              const locBride = (day.job_locations || []).find((l: any) => String(l.location_name || "").toLowerCase().includes("gai")) || {};

              const groomAddr = locGroom.address || job.customers?.address || "";
              const brideAddr = locBride.address || "";

              return (
                <div key={day.id || index} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h3 className="font-bold text-slate-800 text-sm">
                      Ngay {index + 1}{day.note ? ` – ${day.note}` : ""}: {formatDateVN(day.shooting_date)} • {day.start_time?.slice(0, 5)} - {day.end_time?.slice(0, 5)}
                    </h3>
                    <button
                      type="button"
                      onClick={() => copySingleDay(day, index)}
                      className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1 font-semibold text-blue-600 hover:bg-blue-100 transition-colors"
                    >
                      📋 Sao chep ngay nay
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs min-w-[750px] border rounded-xl overflow-hidden">
                      <thead className="border-b bg-slate-50 text-slate-600 font-semibold">
                        <tr>
                          <th className="p-2.5">Dia diem</th>
                          <th className="p-2.5">Dia chi / SDT</th>
                          <th className="p-2.5">Vai tro</th>
                          <th className="p-2.5">Tho</th>
                          <th className="p-2.5">Luong</th>
                          <th className="p-2.5 text-center">SDT cho tho</th>
                          <th className="p-2.5">Ghi chu</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y text-slate-700 bg-white">
                        {(day.job_assignments || []).map((a: any) => {
                          const isGroom = String(a.work_location_name || "").toLowerCase().includes("trai");
                          const address = isGroom ? (groomAddr || a.work_location_address) : (brideAddr || a.work_location_address);
                          const phone = isGroom ? (job.customers?.phone || job.customer_phone) : (job.customers?.secondary_phone || job.secondary_phone);

                          return (
                            <tr key={a.id} className="hover:bg-slate-50/70">
                              <td className="p-2.5 font-bold text-slate-800">{a.work_location_name || (isGroom ? "Nha trai" : "Nha gai")}</td>
                              <td className="p-2.5">
                                <div className="font-medium text-slate-800">{address || "Chua nhap dia chi"}</div>
                                {phone && <div className="text-[11px] text-slate-500 font-mono mt-0.5">{phone}</div>}
                              </td>
                              <td className="p-2.5 text-slate-600">{a.role}</td>
                              <td className="p-2.5 font-bold text-slate-900">{a.employees?.full_name || "Chua xep tho"}</td>
                              <td className="p-2.5 font-bold text-slate-800">{money(a.salary_amount)}</td>
                              <td className="p-2.5 text-center">
                                {a.contact_visible !== false ? (
                                  <span className="rounded bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                                    Dang mo SDT
                                  </span>
                                ) : (
                                  <span className="rounded bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500 border">
                                    Da dong
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5 text-slate-500">{a.note || "-"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {showPayModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4 shadow-xl">
              <h3 className="font-bold text-base text-slate-800">Thu tien thanh toan</h3>
              <div>
                <label className="text-xs text-slate-600 block mb-1">So tien</label>
                <MoneyInput
                  className="w-full border p-2.5 rounded-xl font-bold text-emerald-600 text-sm"
                  value={payAmount}
                  onChange={(v: number) => setPayAmount(v)}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowPayModal(false)} className="px-4 py-2 border rounded-xl text-xs font-semibold">Huy</button>
                <button onClick={handlePayMore} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold">Xac nhan</button>
              </div>
            </div>
          </div>
        )}

        {showExtraModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4 shadow-xl">
              <h3 className="font-bold text-base text-slate-800">Them khoan phat sinh</h3>
              <div>
                <label className="text-xs text-slate-600 block mb-1">So tien</label>
                <MoneyInput
                  className="w-full border p-2.5 rounded-xl font-bold text-amber-600 text-sm"
                  value={extraAmount}
                  onChange={(v: number) => setExtraAmount(v)}
                />
              </div>
              <div>
                <label className="text-xs text-slate-600 block mb-1">Noi dung</label>
                <input
                  className="w-full border p-2.5 rounded-xl text-xs"
                  value={extraNote}
                  onChange={(e) => setExtraNote(e.target.value)}
                  placeholder="Phat sinh..."
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowExtraModal(false)} className="px-4 py-2 border rounded-xl text-xs font-semibold">Huy</button>
                <button onClick={handleAddExtraFee} className="px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold">Luu</button>
              </div>
            </div>
          </div>
        )}

        <div className="sticky bottom-0 z-25 flex justify-end gap-2 border-t bg-white px-6 py-4 rounded-b-2xl">
          <button
            onClick={copyFullJob}
            className="rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 shadow-sm"
          >
            📋 Sao chep day du Job
          </button>
          <button onClick={onClose} className="rounded-xl border px-4 py-2 font-semibold hover:bg-slate-50">Dong</button>
          <button onClick={onEdit} className="rounded-xl bg-amber-500 px-4 py-2 font-semibold text-white">Sua job</button>
          <button onClick={onDelete} className="rounded-xl bg-rose-600 px-4 py-2 font-semibold text-white">Xoa job</button>
        </div>
      </div>
    </div>
  );
}
