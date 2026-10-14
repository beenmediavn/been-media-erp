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
  required_photo_count: 0,
  required_video_count: 0,
};

const makeAssignment = (role = "Thợ chụp") => ({
  employee_id: "",
  role,
  salary_amount: role === "Thợ quay" ? 900000 : 700000,
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

const getJobAddress = (job: any) => {
  const firstDay = getFirstJobDay(job);
  const firstAssignment = firstDay.job_assignments?.[0];
  return (
    firstAssignment?.work_location_address ||
    firstAssignment?.work_location_name ||
    firstDay.location ||
    job.location ||
    ""
  );
};

const getEventDateText = (job: any) => {
  const days = job.job_days || [];
  if (!days.length) return "";
  return days
    .map((day: any) => {
      const timeText = [day.start_time, day.end_time].filter(Boolean).join(" - ");
      return `${timeText ? `${timeText} ` : ""}${formatDateVN(day.shooting_date)}`.trim();
    })
    .join(" . ");
};

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

type QuickJobDay = { label: string; shooting_date: string; start_time: string; end_time?: string };
type QuickJobPreview = {
  main_phone?: string;
  groom_name?: string;
  bride_name?: string;
  groom_phone?: string;
  bride_phone?: string;
  groom_address?: string;
  bride_address?: string;
  package_price?: number;
  photo_count?: number;
  video_count?: number;
  designated_worker?: string;
  days: QuickJobDay[];
  note?: string;
};
const qPhone = (s: string) => s.replace(/\D/g, "");
const qPad = (n: number) => String(n).padStart(2, "0");
const timeToMinutes = (value: any) => { const m = String(value || "00:00").match(/^(\d{1,2}):(\d{2})/); return m ? Number(m[1]) * 60 + Number(m[2]) : 0; };
const timeOverlaps = (aStart: any, aEnd: any, bStart: any, bEnd: any) => timeToMinutes(aStart) < timeToMinutes(bEnd) && timeToMinutes(aEnd) > timeToMinutes(bStart);
const roleKind = (role: any) => { const r = String(role || "").toLowerCase(); if (r.includes("chụp")) return "photo"; if (r.includes("quay") && !r.includes("fly")) return "video"; return "other"; };

function qSection(raw: string, n: number) {
  const text = raw.replace(/\r/g, "");
  const re = new RegExp(`(?:^|\\n)\\s*${n}\\s*[\\.:\\)]?\\s*([\\s\\S]*?)(?=\\n\\s*[1-8]\\s*[\\.:\\)]?\\s|$)`, `i`);
  return (text.match(re)?.[1] || "").trim();
}
function qFirstPhone(text: string) {
  const vals = [...text.matchAll(/(?:\+?84|0)[\d.\s-]{8,14}\d/g)].map(x => qPhone(x[0])).filter(x => x.length >= 9 && x.length <= 11);
  return vals[0] || "";
}
function qTimeFromText(text: string) {
  const all = [...text.matchAll(/\b(\d{1,2})(?:\s*h|:)(\d{1,2})?\s*(sáng|chiều|tối)?/gi)];
  const cv = (m: RegExpMatchArray) => {
    let h = Number(m[1]), min = Number(m[2] || 0); const part = (m[3] || "").toLowerCase();
    if ((part === "chiều" || part === "tối") && h < 12) h += 12;
    if (part === "sáng" && h === 12) h = 0;
    return `${qPad(Math.min(23, h))}:${qPad(Math.min(59, min))}`;
  };
  return { start: all[0] ? cv(all[0]) : "", end: all[1] ? cv(all[1]) : "" };
}
function qDateFromText(text: string, baseMonth: string) {
  const afterDay = text.match(/(?:ngày\s*)?([0-3]?\d)[\/-]([01]?\d)(?:[\/-](20\d{2}|\d{2}))?/i);
  if (!afterDay) return "";
  let y = afterDay[3] ? Number(afterDay[3]) : Number(baseMonth.slice(0, 4)); if (y < 100) y += 2000;
  return `${y}-${qPad(Number(afterDay[2]))}-${qPad(Number(afterDay[1]))}`;
}
function qAddress(section: string, kind: "groom" | "bride") {
  const phone = qFirstPhone(section);
  let value = section
    .replace(kind === "groom" ? /^(?:địa\s*chỉ\s*)?(?:nhà\s*trai|nhà\s*chú\s*rể|địa\s*điểm\s*chính)\s*(?:\/\s*địa\s*điểm\s*chính)?\s*[:\-]?\s*/i : /^(?:địa\s*chỉ\s*)?(?:nhà\s*gái|nhà\s*cô\s*dâu|địa\s*điểm\s*thứ\s*2)\s*(?:\/\s*địa\s*điểm\s*thứ\s*2)?\s*[:\-]?\s*/i, "")
    .split(/\n+/)
    .filter(line => !/(?:sđt|số\s*điện\s*thoại|điện\s*thoại)\s*(?:liên\s*hệ)?\s*:/i.test(line))
    .join(", ")
    .replace(/(?:sđt|số\s*điện\s*thoại|điện\s*thoại)\s*(?:liên\s*hệ)?\s*:\s*(?:\+?84|0)[\d.\s-]{8,14}\d/ig, "")
    .replace(/\s+,/g, ",").replace(/,\s*,/g, ",").replace(/\s{2,}/g, " ").trim().replace(/^[:\-\s]+|[,\s]+$/g, "");
  return { address: value, phone };
}
function parseQuickJob(raw: string, baseMonth: string): QuickJobPreview {
  const original = raw.trim();
  const s1 = qSection(original, 1), s2 = qSection(original, 2), s3 = qSection(original, 3), s4 = qSection(original, 4), s5 = qSection(original, 5), s6 = qSection(original, 6), s7 = qSection(original, 7), s8 = qSection(original, 8);
  const out: QuickJobPreview = { days: [], note: original };
  out.main_phone = qFirstPhone(s1 || original);

  if (s2) {
    let names = s2.replace(/^.*?(?:chú\s*rể|chu\s*re)\s*[:\-]?\s*/i, "").trim();
    const parts = names.split(/\s+(?:và|va|&)\s+|\s*\+\s*/i).map(v => v.trim()).filter(Boolean);
    if (parts.length >= 2) { out.bride_name = parts[0]; out.groom_name = parts[1]; }
  }

  const groom = qAddress(s4, "groom"), bride = qAddress(s5, "bride");
  out.groom_address = groom.address; out.groom_phone = groom.phone;
  out.bride_address = bride.address; out.bride_phone = bride.phone;
  if (!out.groom_phone && out.main_phone) out.groom_phone = out.main_phone;
  if (!out.bride_phone && out.main_phone) out.bride_phone = out.main_phone;

  const dateLines = (s3 || original).split(/\n+/).map(v => v.trim()).filter(Boolean);
  for (const line of dateLines) {
    const date = qDateFromText(line, baseMonth); if (!date) continue;
    const times = qTimeFromText(line);
    let label = (line.split(":")[0] || "").trim();
    label = label.replace(/^[-–•\s]+/, "");
    if (!label || /^ngày/i.test(label)) label = "Ngày chụp";
    out.days.push({ label, shooting_date: date, start_time: times.start, end_time: times.end });
  }
  if (!out.days.length) {
    const date = qDateFromText(original, baseMonth); const times = qTimeFromText(original);
    if (date) out.days = [{ label: /ăn\s*hỏi/i.test(original) ? "Lễ ăn hỏi" : /cưới/i.test(original) ? "Lễ cưới" : "Ngày chụp", shooting_date: date, start_time: times.start, end_time: times.end }];
  }
  out.days = out.days.filter((d, i, a) => a.findIndex(x => x.shooting_date === d.shooting_date && x.label.toLowerCase() === d.label.toLowerCase()) === i);

  const priceDigits = (s6.match(/[\d][\d.,\s]*/)?.[0] || "").replace(/\D/g, "");
  if (priceDigits) out.package_price = Number(priceDigits);
  const pm = s7.match(/chụp\s*[:\-]?\s*(\d+)/i), vm = s7.match(/quay\s*[:\-]?\s*(\d+)/i);
  if (pm) out.photo_count = Number(pm[1]); if (vm) out.video_count = Number(vm[1]);
  if (s8) out.designated_worker = s8.replace(/^.*?thợ\s*đích\s*danh(?:\s*\([^)]*\))?\s*[:\-]?\s*/i, "").trim() || s8.trim();

  if (!out.bride_name && !out.groom_name) {
    const nm = original.match(/(?:cô\s*dâu|cd)\s*[:\-]?\s*([^\n,+&]+).*?(?:chú\s*rể|cr)\s*[:\-]?\s*([^\n,+&]+)/i);
    if (nm) { out.bride_name = nm[1].trim(); out.groom_name = nm[2].trim(); }
  }
  return out;
}

export default function AdminJobPage() {
  const [showQuickJob, setShowQuickJob] = useState(false);
  const [quickText, setQuickText] = useState("");
  const [quickPreview, setQuickPreview] = useState<QuickJobPreview | null>(null);

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
  const quickBaseMonth = `${filterYear}-${String(filterMonth === "all" ? new Date().getMonth() + 1 : filterMonth).padStart(2, "0")}`;

  const [offlineDraftCount, setOfflineDraftCount] = useState(0);

  const requestPin = async (action = "thao tác này") => {
    const { data } = await supabase.from("app_settings").select("value").eq("id", "edit_pin").maybeSingle();
    const pin = data?.value || "2580";
    const entered = window.prompt(`Nhập PIN để ${action}:`);
    if (entered === null) return false;
    if (entered !== pin) { alert("PIN không đúng"); return false; }
    return true;
  };

  const refreshOfflineCount = async () => {
    try {
      const indexed = await getOfflineCount();
      let legacy = 0;
      try { legacy = JSON.parse(localStorage.getItem("been_offline_job_drafts") || "[]").length; } catch {}
      setOfflineDraftCount(indexed + legacy);
    } catch { setOfflineDraftCount(0); }
  };

  const swapBrideGroomPhones = () => {
    const groom = customerForm.phone || "";
    const bride = customerForm.secondary_phone || "";
    setCustomerForm((prev: any) => ({ ...prev, phone: bride, secondary_phone: groom }));
    setDays((prev: any[]) => prev.map((day: any) => ({
      ...day,
      locations: (day.locations || []).map((loc: any) => {
        const n = String(loc.location_name || "").toLowerCase();
        if (n.includes("nhà trai") || n.includes("chú rể")) return { ...loc, phone: bride };
        if (n.includes("nhà gái") || n.includes("cô dâu")) return { ...loc, phone: groom };
        return loc;
      })
    })));
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
      try {
        const cached = await getOfflineCache<any>("admin-job-data");
        if (cached?.data) { setJobs(cached.data.jobs || []); setCustomers(cached.data.customers || []); setEmployees(cached.data.employees || []); setReserveWorkers(cached.data.reserveWorkers || []); return; }
      } catch {}
      if (typeof navigator === "undefined" || navigator.onLine) alert(jobError.message);
      return;
    }

    setJobs(jobData || []);
    setCustomers(customerData || []);
    setEmployees(empData || []);
    setReserveWorkers(reserveData || []);
    setOfflineCache("admin-job-data", { jobs: jobData || [], customers: customerData || [], employees: empData || [], reserveWorkers: reserveData || [] }).catch(() => {});
  }

  useEffect(() => {
    loadData();
    refreshOfflineCount();
    const unsubscribe = subscribeOfflineQueue(refreshOfflineCount);
    const synced = () => { refreshOfflineCount(); loadData(); };
    window.addEventListener("been:offline-sync-complete", synced);
    return () => { unsubscribe(); window.removeEventListener("been:offline-sync-complete", synced); };
  }, []);

  useEffect(() => {
    if (!employees.length || typeof window === "undefined") return;
    const raw = localStorage.getItem("been_ai_job_draft");
    if (!raw) return;
    localStorage.removeItem("been_ai_job_draft");
    try {
      const d = JSON.parse(raw);
      const existing = customers.find((c: any) => (d.phone && normalizePhone(c.phone) === normalizePhone(d.phone)) || (d.customer_name && String(c.full_name || "").toLowerCase() === String(d.customer_name).toLowerCase()));
      setEditingJob(null);
      setCustomerForm({
        ...emptyCustomer,
        customer_id: existing?.id || "",
        full_name: d.customer_name || existing?.full_name || "",
        phone: d.phone || existing?.phone || "",
        secondary_phone: d.secondary_phone || existing?.secondary_phone || "",
        email: existing?.email || "", address: existing?.address || "", facebook: existing?.facebook || "",
      });
      setJobForm({
        ...emptyJob, event_name: d.event_name || "", booking_date: d.booking_date || new Date().toISOString().slice(0, 10), service: d.service || "Combo VIP", total_price: Number(d.total_price || 0), deposit: Number(d.deposit || 0), location: d.address || "", note: d.note || ""
      });
      const ass = (d.assignments || []).map((a: any) => {
        const wanted = String(a.employee_name || "").trim().toLowerCase();
        const emp = wanted ? employees.find((e: any) => { const n = String(e.full_name || "").trim().toLowerCase(); return n === wanted || n.includes(wanted) || wanted.includes(n); }) : undefined;
        return { employee_id: emp?.id || "", role: a.role || "Thợ chụp", salary_amount: Number(a.salary_amount || ((a.role || "").includes("quay") ? 900000 : 700000)), note: a.note || "", client_requested: Boolean(a.client_requested), contact_visible: Boolean(a.contact_visible) };
      });
      setDays([{ shooting_date: d.shooting_date || "", start_time: d.start_time || "07:00", end_time: d.end_time || "11:00", note: d.note || "", locations: [{ location_name: d.location_name || "Địa điểm", address: d.address || "", phone: d.location_phone || "", note: d.note || "", assignments: ass.length ? ass : [makeAssignment("Thợ chụp")] }] }]);
      setOpenForm(true);
      alert("AI đã điền trước Job. Hãy kiểm tra lại trước khi bấm Lưu Job.");
    } catch {}
  }, [employees, customers]);

  useEffect(() => {
    setDays((prev: any[]) => prev.map((day: any) => ({
      ...day,
      locations: (day.locations || []).map((loc: any) => {
        const n = String(loc.location_name || "").toLowerCase();
        if (n.includes("nhà trai") || n.includes("chú rể")) return { ...loc, phone: customerForm.phone || loc.phone };
        if (n.includes("nhà gái") || n.includes("cô dâu")) return { ...loc, phone: customerForm.secondary_phone || loc.phone };
        return loc;
      })
    })));
  }, [customerForm.phone, customerForm.secondary_phone]);

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
          groups[key].assignments.push({ employee_id: assignment.employee_id || "", role: assignment.role || "Thợ chụp", salary_amount: Number(assignment.salary_amount || 0), note: assignment.note || "", client_requested: Boolean(assignment.client_requested), contact_visible: Boolean(assignment.contact_visible) });
        });
        locations.push(...Object.values(groups));
      }
      return { shooting_date: day.shooting_date || "", start_time: day.start_time || "07:00", end_time: day.end_time || "11:00", note: day.note || "", locations: locations.length ? locations : [makeLocation("Nhà trai"), makeLocation("Nhà gái")] };
    });
  };

  const openEdit = async (job: any, options?: { skipPin?: boolean; focusStaff?: boolean }) => {
    if (!options?.skipPin && !(await requestPin("sửa Job"))) return;
    if (options?.focusStaff && typeof window !== "undefined") sessionStorage.setItem("been-focus-staff", "1");
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

  useEffect(() => {
    if (!jobs.length || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const id = params.get("open");
    if (!id) return;
    const found = jobs.find((j: any) => String(j.id) === String(id));
    if (!found) return;

    if (params.get("edit") === "1") {
      openEdit(found, { skipPin: true, focusStaff: params.get("focus") === "staff" });
    } else {
      setSelectedJob(found);
    }
    window.history.replaceState({}, "", window.location.pathname);
  }, [jobs]);

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

  const getEmployeeConflict = (employeeId: string, dayIndex: number, locationIndex: number, assignmentIndex: number) => {
    if (!employeeId) return null;
    const currentDay = days[dayIndex];
    if (!currentDay?.shooting_date) return null;
    for (const job of jobs) {
      if (editingJob?.id && job.id === editingJob.id) continue;
      for (const jd of (job.job_days || [])) {
        if (jd.shooting_date !== currentDay.shooting_date) continue;
        if (!timeOverlaps(currentDay.start_time, currentDay.end_time, jd.start_time, jd.end_time)) continue;
        const hit = (jd.job_assignments || []).find((a: any) => a.employee_id === employeeId);
        if (hit) return { job: job.event_name || job.customer_name || "Job khác", start: jd.start_time, end: jd.end_time };
      }
    }
    for (let di = 0; di < days.length; di++) {
      const d = days[di]; if (d.shooting_date !== currentDay.shooting_date || !timeOverlaps(currentDay.start_time, currentDay.end_time, d.start_time, d.end_time)) continue;
      for (let li = 0; li < (d.locations || []).length; li++) for (let ai = 0; ai < (d.locations[li].assignments || []).length; ai++) {
        if (di === dayIndex && li === locationIndex && ai === assignmentIndex) continue;
        if (d.locations[li].assignments[ai].employee_id === employeeId) return { job: "Phân công khác trong Job đang nhập", start: d.start_time, end: d.end_time };
      }
    }
    return null;
  };

  const addReservedWorker = (dayIndex: number, locationIndex: number, reserve: any) => {
    const emp = employees.find((x: any) => x.id === reserve.employee_id) || reserve.employees;
    const reserveRole = reserve.role || emp?.role || "Thợ chụp";
    setDays((prev) => prev.map((day, i) => {
      if (i !== dayIndex) return day;
      const alreadyInDay = (day.locations || []).some((loc: any) => (loc.assignments || []).some((a: any) => String(a.employee_id) === String(reserve.employee_id)));
      if (alreadyInDay) {
        setTimeout(() => alert(`${emp?.full_name || "Thợ"} đã có trong phân công của ngày này.`), 0);
        return day;
      }
      return {
        ...day, locations: day.locations.map((loc: any, j: number) => {
          if (j !== locationIndex) return loc;
          const assignments = [...(loc.assignments || [])];
          let emptyIndex = assignments.findIndex((a: any) => !a.employee_id && roleKind(a.role) === roleKind(reserveRole));
          if (emptyIndex < 0) emptyIndex = assignments.findIndex((a: any) => !a.employee_id);
          const nextAssignment = { employee_id: reserve.employee_id, role: reserveRole, salary_amount: Number(emp?.base_fee || (String(reserveRole).toLowerCase().includes("quay") ? 900000 : 700000)), note: "Thêm từ thợ dự phòng", reserve_worker_id: reserve.id, client_requested: false, contact_visible: false };
          if (emptyIndex >= 0) assignments[emptyIndex] = { ...assignments[emptyIndex], ...nextAssignment };
          else assignments.push(nextAssignment);
          return { ...loc, assignments };
        })
      };
    }));
  };

  const availableReserveWorkersForDay = (day: any) => {
    if (!day?.shooting_date) return [];
    const usedReserveIds = new Set<string>();
    const usedEmployeeIds = new Set<string>();
    for (const loc of (day.locations || [])) for (const a of (loc.assignments || [])) {
      if (a?.reserve_worker_id) usedReserveIds.add(String(a.reserve_worker_id));
      if (a?.employee_id) usedEmployeeIds.add(String(a.employee_id));
    }
    return reserveWorkers.filter((r: any) => r.reserve_date === day.shooting_date && !usedReserveIds.has(String(r.id)) && !usedEmployeeIds.has(String(r.employee_id)));
  };

  const updateDay = (dayIndex: number, key: string, value: any) => {
    setDays((prev) => prev.map((day, i) => (i === dayIndex ? { ...day, [key]: value } : day)));
  };

  const addLocation = (dayIndex: number) => {
    setDays((prev) =>
      prev.map((day, i) =>
        i === dayIndex
          ? { ...day, locations: [...day.locations, makeLocation(`Địa điểm ${day.locations.length + 1}`)] }
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

  const saveOfflineDraft = async () => {
    try {
      const bundle = makeOfflineJobBundle(customerForm, jobForm, days, editingJob);
      await queueOfflineJob(bundle);
      await refreshOfflineCount();
      setOpenForm(false);
      alert("Đã lưu OFFLINE trên thiết bị. Khi có mạng, app sẽ tự đồng bộ lên hệ thống.");
    } catch (error: any) {
      alert(error?.message || "Không lưu được dữ liệu offline trên thiết bị");
    }
  };

  async function markUsedReserveWorkers(jobId: string) {
    const ids: string[] = Array.from(new Set<string>(days.flatMap((day: any) => day.locations?.flatMap((loc: any) => loc.assignments?.map((a: any) => a.reserve_worker_id).filter(Boolean) || []) || []) as string[]));
    if (!ids.length) return;
    const { error } = await supabase.from("reserve_workers").update({ status: "used", assigned_job_id: jobId, assigned_at: new Date().toISOString() }).in("id", ids);
    if (error) throw error;
    setReserveWorkers((prev: any[]) => prev.filter((r: any) => !ids.includes(r.id)));
  }

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
    if (!jobForm.service.trim()) {
      alert("Vui lòng nhập gói dịch vụ");
      return;
    }
    if (days.some((day) => !day.shooting_date)) {
      alert("Vui lòng nhập đầy đủ ngày chụp");
      return;
    }
    for (let di = 0; di < days.length; di++) {
      for (let li = 0; li < (days[di].locations || []).length; li++) {
        for (let ai = 0; ai < (days[di].locations[li].assignments || []).length; ai++) {
          const a = days[di].locations[li].assignments[ai];
          if (!a.employee_id) continue;
          const conflict = getEmployeeConflict(a.employee_id, di, li, ai);
          if (conflict) {
            const emp = employees.find((e: any) => e.id === a.employee_id);
            alert(`${emp?.full_name || "Nhân sự"} đã có lịch trùng giờ ${conflict.start}-${conflict.end} (${conflict.job}).`);
            return;
          }
        }
      }
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) { await saveOfflineDraft(); return; }

    setSaving(true);
    let createdJobIdForRollback: string | null = null;

    try {
      let customerId = customerForm.customer_id;
      const total = Number(jobForm.total_price || 0);
      const deposit = Number(jobForm.deposit || 0);
      const debt = total - deposit;

      if (!customerId) {
        const phone = String(customerForm.phone || "").trim();
        const email = String(customerForm.email || "").trim();
        const name = String(customerForm.full_name || "").trim();

        const existingCustomer = customers.find((customer) => {
          const samePhone = phone && String(customer.phone || "").trim() === phone;
          const sameEmail = email && String(customer.email || "").trim().toLowerCase() === email.toLowerCase();
          const sameName = name && String(customer.full_name || "").trim().toLowerCase() === name.toLowerCase();
          return samePhone || sameEmail || sameName;
        });

        if (existingCustomer) {
          customerId = existingCustomer.id;
          const { error: updateExistingError } = await supabase
            .from("customers")
            .update({
              full_name: name || existingCustomer.full_name,
              phone: phone || existingCustomer.phone,
              secondary_phone: customerForm.secondary_phone,
              email: email || existingCustomer.email,
              address: customerForm.address || existingCustomer.address,
              facebook: customerForm.facebook || existingCustomer.facebook,
              service: jobForm.service,
              total_price: total,
              deposit,
              debt,
              status: jobForm.status,
              note: jobForm.note,
            })
            .eq("id", customerId);
          if (updateExistingError) throw updateExistingError;
        } else {
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
      } else {
        const { error: updateCustomerError } = await supabase
          .from("customers")
          .update({
            secondary_phone: customerForm.secondary_phone,
            service: jobForm.service,
            total_price: total,
            deposit,
            debt,
            status: jobForm.status,
          })
          .eq("id", customerId);
        if (updateCustomerError) throw updateCustomerError;
      }

      if (editingJob) {
        const { error: updateJobError } = await supabase
          .from("jobs")
          .update({
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
          })
          .eq("id", editingJob.id);

        if (updateJobError) throw updateJobError;

        const { error: deleteDaysError } = await supabase
          .from("job_days")
          .delete()
          .eq("job_id", editingJob.id);

        if (deleteDaysError) throw deleteDaysError;

        for (const day of days) {
          const locationSummary = day.locations
            .map((loc: any) => `${loc.location_name}:${loc.address}`)
            .join(" | ");

          const { data: createdDay, error: dayError } = await supabase
            .from("job_days")
            .insert([
              {
                job_id: editingJob.id,
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
            const { error: locationError } = await supabase.from("job_locations").insert(
              day.locations.map((location: any, sortIndex: number) => ({
                job_day_id: createdDay.id,
                location_name: location.location_name,
                address: location.address,
                phone: location.phone,
                sort_order: sortIndex,
              }))
            );
            if (locationError) throw locationError;
          }

          const assignmentRows = day.locations.flatMap((location: any) =>
            location.assignments
              .filter((assignment: any) => assignment.employee_id)
              .map((assignment: any) => ({
                job_id: editingJob.id,
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

        await markUsedReserveWorkers(editingJob.id);
        setOpenForm(false);
        setEditingJob(null);
        setCustomerForm({ ...emptyCustomer });
        setJobForm({ ...emptyJob });
        setDays([makeDay()]);
        await loadData();
        return;
      }

      const { data: createdJob, error: jobError } = await supabase
        .from("jobs")
        .insert([
          {
            job_code: "JOB" + Date.now(),
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
          },
        ])
        .select("id")
        .single();

      if (jobError) throw jobError;
      createdJobIdForRollback = createdJob.id;

      if (deposit > 0) {
        const { error: paymentError } = await supabase.from("customer_payments").insert([
          {
            customer_id: customerId,
            job_id: createdJob.id,
            amount: deposit,
            method: "Đặt cọc",
            note: "Tự tạo khi tạo job",
          },
        ]);
        if (paymentError) throw paymentError;
      }

      for (const day of days) {
        const locationSummary = day.locations
          .map((loc: any) => `${loc.location_name}:${loc.address}`)
          .join(" | ");

        const { data: createdDay, error: dayError } = await supabase
          .from("job_days")
          .insert([
            {
              job_id: createdJob.id,
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
          const { error: locationError } = await supabase.from("job_locations").insert(
            day.locations.map((location: any, sortIndex: number) => ({
              job_day_id: createdDay.id,
              location_name: location.location_name,
              address: location.address,
              phone: location.phone,
              sort_order: sortIndex,
            }))
          );
          if (locationError) throw locationError;
        }

        const assignmentRows = day.locations.flatMap((location: any) =>
          location.assignments
            .filter((assignment: any) => assignment.employee_id)
            .map((assignment: any) => ({
              job_id: createdJob.id,
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

      await markUsedReserveWorkers(createdJob.id);
      createdJobIdForRollback = null;
      setOpenForm(false);
      setCustomerForm({ ...emptyCustomer });
      setJobForm({ ...emptyJob });
      setDays([makeDay()]);
      await loadData();
    } catch (error: any) {
      if (createdJobIdForRollback) {
        await supabase.from("jobs").delete().eq("id", createdJobIdForRollback);
      }
      alert(error.message || "Không lưu được job");
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
    setJobs((prev) => prev.filter((j: any) => j.id !== id));
    loadData();
  }

  const years = useMemo(() => {
    const ys = new Set<number>([new Date().getFullYear()]);
    jobs.forEach((j: any) => (j.job_days || []).forEach((d: any) => { const y = Number(String(d.shooting_date || "").slice(0, 4)); if (y) ys.add(y); }));
    return Array.from(ys).sort((a, b) => b - a);
  }, [jobs]);

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
        job.customers?.full_name,
        job.customers?.phone,
        job.service,
        ...assigns.map((a: any) => a.employees?.full_name)
      ].join(" ").toLowerCase();

      return !q || text.includes(q);
    });
  }, [periodJobs, statusTab, filterEmployee, search]);

  const periodTotals = useMemo(() => {
    const completedCount = periodJobs.filter((j: any) => isJobDoneActual(j)).length;
    return {
      total: periodJobs.length,
      completed: completedCount,
      incomplete: periodJobs.length - completedCount,
      revenue: periodJobs.reduce((s: number, j: any) => s + Number(j.total_price || 0), 0),
      debt: periodJobs.reduce((s: number, j: any) => s + Math.max(Number(j.debt ?? (Number(j.total_price || 0) - Number(j.deposit || 0))), 0), 0),
      salary: periodJobs.reduce((s: number, j: any) => s + (j.job_days || []).reduce((ds: number, d: any) => ds + (d.job_assignments || []).reduce((as: number, a: any) => as + Number(a.salary_amount || 0), 0), 0), 0),
    };
  }, [periodJobs]);

  return (
    <MainLayout>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Job / Booking</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Quản lý lịch quay/chụp, ekip thợ và tự động nhận diện hoàn thành theo ngày/giờ
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => { setQuickText(""); setQuickPreview(null); setShowQuickJob(true); }}
            className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs sm:text-sm font-semibold text-blue-700 shadow-sm"
          >
            ✦ Nhập Job nhanh
          </button>
          <button
            onClick={openCreate}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            + Tạo job mới
          </button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="bg-white rounded-2xl p-4 shadow-sm border">
          <p className="text-xs text-slate-500">Job tổng</p>
          <p className="text-2xl font-black text-slate-800 mt-1">{periodTotals.total}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border">
          <p className="text-xs text-slate-500">Đã hoàn thành</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">{periodTotals.completed}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border">
          <p className="text-xs text-slate-500">Chưa hoàn thành</p>
          <p className="text-2xl font-black text-amber-600 mt-1">{periodTotals.incomplete}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border">
          <p className="text-xs text-slate-500">Doanh thu</p>
          <p className="text-lg sm:text-xl font-bold text-slate-800 mt-1">{money(periodTotals.revenue)}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border">
          <p className="text-xs text-slate-500">Khách còn nợ</p>
          <p className="text-lg sm:text-xl font-bold text-rose-600 mt-1">{money(periodTotals.debt)}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border">
          <p className="text-xs text-slate-500">Lương thợ</p>
          <p className="text-lg sm:text-xl font-bold text-orange-600 mt-1">{money(periodTotals.salary)}</p>
        </div>
      </div>

      <div className="mb-5 rounded-2xl bg-white p-4 shadow-sm border">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-xs font-semibold text-slate-600">
            Tìm kiếm
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mt-1 w-full rounded-xl border p-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500"
              placeholder="Tên khách, SĐT, sự kiện, mã Job..."
            />
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Năm
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border p-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500"
            >
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Tháng
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value === "all" ? "all" : Number(e.target.value))}
              className="mt-1 w-full rounded-xl border p-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Cả năm</option>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>Tháng {i + 1}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Lọc theo thợ
            <select
              value={filterEmployee}
              onChange={(e) => setFilterEmployee(e.target.value)}
              className="mt-1 w-full rounded-xl border p-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tất cả thợ</option>
              {employees.map((e: any) => (
                <option key={e.id} value={e.id}>{e.full_name}</option>
              ))}
            </select>
          </label>
          
          <div className="flex items-end gap-1.5 sm:gap-2">
            {(
              [
                ["all", "Job tổng"],
                ["completed", "Đã xong"],
                ["incomplete", "Chưa xong"],
              ] as const
            ).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setStatusTab(k)}
                className={`flex-1 rounded-xl py-2.5 text-xs sm:text-sm font-bold transition-all ${
                  statusTab === k
                    ? "bg-blue-600 text-white shadow-sm"
                    : "border bg-white text-slate-700 hover:bg-slate-50"
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
          <table className="w-full min-w-[1100px] text-left text-xs">
            <thead className="border-b bg-slate-50 text-[11px] font-semibold uppercase text-slate-600">
              <tr>
                <th className="p-3.5">Mã job</th>
                <th className="p-3.5">Sự kiện</th>
                <th className="p-3.5">Khách hàng</th>
                <th className="p-3.5">Dịch vụ</th>
                <th className="p-3.5">Ngày chụp</th>
                <th className="p-3.5 text-right">Doanh thu</th>
                <th className="p-3.5 text-right">Còn nợ</th>
                <th className="p-3.5 text-right">Lương thợ</th>
                <th className="p-3.5">Ekip</th>
                <th className="p-3.5 text-center">Trạng thái</th>
                <th className="p-3.5 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y text-slate-700">
              {loading && (
                <tr>
                  <td className="p-8 text-center text-slate-400" colSpan={11}>
                    Đang tải danh sách Job...
                  </td>
                </tr>
              )}
              {!loading && filteredJobs.length === 0 && (
                <tr>
                  <td className="p-8 text-center text-slate-400" colSpan={11}>
                    Không tìm thấy Job nào phù hợp điều kiện lọc.
                  </td>
                </tr>
              )}
              {filteredJobs.map((job) => {
                const salary = (job.job_days || []).reduce(
                  (sum: number, day: any) =>
                    sum +
                    (day.job_assignments || []).reduce(
                      (s: number, a: any) => s + Number(a.salary_amount || 0),
                      0
                    ),
                  0
                );
                const statusInfo = getJobDetailedStatus(job);
                const debt = Number(job.debt ?? (Number(job.total_price || 0) - Number(job.deposit || 0)));

                return (
                  <tr key={job.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 font-bold text-slate-900">{job.job_code}</td>
                    <td className="p-3.5 font-bold text-slate-800">{job.event_name || "Chưa đặt tên"}</td>
                    <td className="p-3.5">
                      <div className="font-bold text-slate-800">{job.customers?.full_name || job.customer_name || "Chưa chọn"}</div>
                      <div className="text-[11px] text-slate-500">{job.customers?.phone || job.customer_phone}</div>
                      {job.customers?.secondary_phone && (
                        <div className="text-[11px] text-slate-400">Phụ: {job.customers.secondary_phone}</div>
                      )}
                    </td>
                    <td className="p-3.5 font-medium">{job.service}</td>
                    <td className="p-3.5 whitespace-nowrap">
                      {(job.job_days || []).map((d: any) => d.shooting_date).join(", ")}
                    </td>
                    <td className="p-3.5 text-right font-bold text-slate-800">{money(job.total_price)}</td>
                    <td className="p-3.5 text-right font-bold text-rose-600">{money(debt)}</td>
                    <td className="p-3.5 text-right font-bold text-orange-600">{money(salary)}</td>
                    <td className="p-3.5">
                      <div className="flex max-w-[280px] flex-wrap gap-1">
                        {Array.from(
                          new Map(
                            (job.job_days || [])
                              .flatMap((d: any) => d.job_assignments || [])
                              .filter((a: any) => a.employee_id)
                              .map((a: any) => [a.employee_id, a])
                          ).values()
                        )
                          .slice(0, 4)
                          .map((a: any) => (
                            <span
                              key={a.employee_id}
                              className={`rounded-full px-2 py-0.5 text-[11px] border ${
                                a.client_requested
                                  ? "bg-rose-50 text-rose-700 border-rose-200 font-bold"
                                  : "bg-slate-100 text-slate-700 border-slate-200"
                              }`}
                            >
                              {a.client_requested ? "⭐ " : ""}{a.employees?.full_name || "Thợ"} • {a.role}
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
                        className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-900"
                      >
                        Xem
                      </button>
                      <button
                        onClick={() => openEdit(job)}
                        className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-600"
                      >
                        Sửa
                      </button>
                      <button
                        onClick={() => deleteJob(job.id)}
                        className="rounded-lg bg-rose-600 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-700"
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
          reserveWorkers={reserveWorkers}
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
          addReservedWorker={addReservedWorker}
          availableReserveWorkersForDay={availableReserveWorkersForDay}
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
          onReload={loadData}
          onClose={() => setSelectedJob(null)}
          onEdit={() => {
            const j = selectedJob;
            setSelectedJob(null);
            openEdit(j);
          }}
          onDelete={() => deleteJob(selectedJob.id)}
        />
      )}

      {showQuickJob && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-sm overflow-y-auto">
          <div className="max-h-[92vh] w-full max-w-4xl flex flex-col rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-20 flex items-center justify-between border-b bg-white px-5 py-4 rounded-t-2xl">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-800">Nhập Job nhanh</h2>
                <p className="text-xs text-slate-500">Tự động đọc mẫu tin nhắn 1→8 của BEEN MEDIA</p>
              </div>
              <button
                onClick={() => setShowQuickJob(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 font-bold"
                title="Đóng (Esc)"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <textarea
                value={quickText}
                onChange={(e) => setQuickText(e.target.value)}
                rows={8}
                className="w-full rounded-xl border p-3 leading-5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={'1. Số điện thoại: ...\n2. Tên Cô Dâu + Chú Rể: ...\n3. Ngày tổ chức...\n4. Địa chỉ Nhà Trai...\n5. Địa chỉ Nhà Gái...\n6. Gói Chốt...\n7. Số lượng nhân sự...\n8. Thợ đích danh...'}
              />
              <button
                onClick={() => setQuickPreview(parseQuickJob(quickText, quickBaseMonth))}
                disabled={!quickText.trim()}
                className="w-full rounded-xl bg-blue-600 py-3 font-bold text-white hover:bg-blue-700 disabled:opacity-40"
              >
                Phân tích thông tin
              </button>

              {quickPreview && (
                <div className="rounded-xl border bg-slate-50 p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-800">Kiểm tra thông tin trước khi tạo Job</h3>
                    <span className="rounded-full bg-blue-100 px-3 py-1 font-bold text-blue-700">
                      Nhận {quickPreview.days.length} ngày
                    </span>
                  </div>

                  <div className="rounded-xl border bg-white p-3 space-y-3">
                    <h4 className="font-bold text-blue-700 uppercase">Khách hàng</h4>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <label className="font-semibold block mb-1">Cô dâu</label>
                        <input
                          value={quickPreview.bride_name || ""}
                          onChange={(e) => setQuickPreview({ ...quickPreview, bride_name: e.target.value })}
                          className="w-full rounded-lg border p-2 text-xs"
                        />
                      </div>
                      <div>
                        <label className="font-semibold block mb-1">Chú rể</label>
                        <input
                          value={quickPreview.groom_name || ""}
                          onChange={(e) => setQuickPreview({ ...quickPreview, groom_name: e.target.value })}
                          className="w-full rounded-lg border p-2 text-xs"
                        />
                      </div>
                      <div>
                        <label className="font-semibold block mb-1">SĐT chính</label>
                        <input
                          value={quickPreview.main_phone || ""}
                          onChange={(e) => setQuickPreview({ ...quickPreview, main_phone: e.target.value })}
                          className="w-full rounded-lg border p-2 text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      const q = quickPreview;
                      if (!q.days.length) {
                        alert("Chưa nhận diện được ngày tổ chức. Vui lòng kiểm tra lại.");
                        return;
                      }
                      setEditingJob(null);
                      const displayName = [q.bride_name, q.groom_name].filter(Boolean).join(" & ");
                      setCustomerForm((c: any) => ({
                        ...c,
                        full_name: displayName || c.full_name,
                        facebook: displayName || c.facebook,
                        phone: q.groom_phone || q.main_phone || c.phone,
                        secondary_phone: q.bride_phone || q.main_phone || c.secondary_phone,
                        address: q.groom_address || q.bride_address || c.address,
                      }));
                      setJobForm((j: any) => ({
                        ...j,
                        event_name: displayName || j.event_name,
                        total_price: Number(q.package_price || j.total_price || 0),
                        required_photo_count: Number(q.photo_count || 0),
                        required_video_count: Number(q.video_count || 0),
                        location: q.groom_address || q.bride_address || j.location,
                        note: [j.note, q.designated_worker ? `Thợ đích danh: ${q.designated_worker}` : "", `Tin gốc:\n${quickText}`].filter(Boolean).join("\n"),
                      }));
                      setDays(
                        q.days.map((qd: any) => {
                          const d = makeDay();
                          d.shooting_date = qd.shooting_date || "";
                          d.start_time = qd.start_time || "";
                          d.end_time = qd.end_time || "";
                          d.note = qd.label || "";
                          d.locations = [makeLocation("Nhà trai"), makeLocation("Nhà gái")];
                          d.locations[0].address = q.groom_address || "";
                          d.locations[0].phone = q.groom_phone || q.main_phone || "";
                          d.locations[1].address = q.bride_address || "";
                          d.locations[1].phone = q.bride_phone || q.main_phone || "";
                          return d;
                        })
                      );
                      setShowQuickJob(false);
                      setOpenForm(true);
                    }}
                    className="w-full rounded-xl bg-emerald-600 py-3 font-bold text-white hover:bg-emerald-700"
                  >
                    ĐƯA VÀO FORM JOB ĐỂ HOÀN THIỆN
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}

function JobForm(props: any) {
  const {
    customers,
    employees,
    reserveWorkers,
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
    addReservedWorker,
    availableReserveWorkersForDay,
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-7xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[92vh]">
        <div className="sticky top-0 z-20 flex items-center justify-between border-b bg-white px-6 py-4 rounded-t-2xl">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-800">
              {editingJob ? "Sửa Job / Booking" : "Tạo mới Job & Phân công"}
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

        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-700 flex-1">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                  onChange={(e) => {
                    const name = e.target.value;
                    setCustomerForm({ ...customerForm, full_name: name, facebook: name });
                  }}
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
                    <option>Chưa chốt</option>
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

          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-blue-700 uppercase">3. Ngày chụp & Phân công thợ</h3>
              <button
                type="button"
                onClick={addDay}
                className="bg-slate-800 text-white px-3.5 py-1.5 rounded-xl font-semibold hover:bg-slate-900"
              >
                + Thêm ngày chụp
              </button>
            </div>

            {days.map((day: any, dayIndex: number) => (
              <div key={dayIndex} className="border rounded-2xl p-4 bg-slate-50 space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="font-bold text-slate-800">Ngày chụp {dayIndex + 1}</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => duplicateDay(dayIndex)}
                      className="rounded-lg border bg-white px-2.5 py-1 font-semibold text-blue-700"
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
                    Ghi chú ca
                    <input
                      className="border p-2 rounded-xl w-full mt-1 bg-white"
                      value={day.note}
                      onChange={(e) => updateDay(dayIndex, "note", e.target.value)}
                      placeholder="Ăn hỏi / đón dâu..."
                    />
                  </label>
                </div>

                {day.locations.map((loc: any, locIndex: number) => (
                  <div key={locIndex} className="rounded-xl border bg-white p-3 space-y-3">
                    <div className="flex items-center justify-between border-b pb-2">
                      <input
                        className="font-bold text-slate-800 border-b border-dashed focus:outline-none"
                        value={loc.location_name}
                        onChange={(e) => updateLocation(dayIndex, locIndex, "location_name", e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => removeLocation(dayIndex, locIndex)}
                        className="text-rose-600 font-semibold"
                      >
                        Xóa địa điểm
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <input
                        className="border p-2 rounded-lg"
                        placeholder="Địa chỉ cụ thể..."
                        value={loc.address}
                        onChange={(e) => updateLocation(dayIndex, locIndex, "address", e.target.value)}
                      />
                      <input
                        className="border p-2 rounded-lg"
                        placeholder="SĐT liên hệ tại điểm..."
                        value={loc.phone}
                        onChange={(e) => updateLocation(dayIndex, locIndex, "phone", e.target.value)}
                      />
                    </div>

                    <div className="space-y-2 pt-1">
                      {loc.assignments.map((assignment: any, assIndex: number) => (
                        <div key={assIndex} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center bg-slate-50 p-2 rounded-lg border">
                          <select
                            className="md:col-span-2 border p-1.5 rounded-lg font-medium text-xs bg-white"
                            value={assignment.role}
                            onChange={(e) => updateAssignment(dayIndex, locIndex, assIndex, "role", e.target.value)}
                          >
                            <option>Thợ chụp</option>
                            <option>Thợ quay</option>
                            <option>Flycam</option>
                            <option>Editor</option>
                          </select>

                          <div className="md:col-span-4">
                            <EmployeePicker
                              employees={employees}
                              value={assignment.employee_id}
                              getConflict={(id) => getEmployeeConflict(id, dayIndex, locIndex, assIndex)}
                              onChange={(id) => {
                                const conflict = id ? getEmployeeConflict(id, dayIndex, locIndex, assIndex) : null;
                                if (conflict) {
                                  alert(`Thợ này đã có Job trùng ${conflict.start}-${conflict.end}:${conflict.job}`);
                                  return;
                                }
                                updateAssignment(dayIndex, locIndex, assIndex, "employee_id", id);
                              }}
                            />
                          </div>

                          <div className="md:col-span-3">
                            <MoneyInput
                              className="border p-1.5 rounded-lg w-full bg-white font-bold"
                              value={assignment.salary_amount}
                              onChange={(v) => updateAssignment(dayIndex, locIndex, assIndex, "salary_amount", v)}
                              placeholder="Tiền công"
                            />
                          </div>

                          <div className="md:col-span-2">
                            <input
                              className="border p-1.5 rounded-lg w-full bg-white text-xs"
                              value={assignment.note}
                              onChange={(e) => updateAssignment(dayIndex, locIndex, assIndex, "note", e.target.value)}
                              placeholder="Ghi chú thợ..."
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => removeAssignment(dayIndex, locIndex, assIndex)}
                            className="md:col-span-1 text-rose-600 font-bold text-center"
                          >
                            ✕
                          </button>
                        </div>
                      ))}

                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => addAssignment(dayIndex, locIndex, "Thợ chụp")}
                          className="rounded-lg border bg-white px-2.5 py-1 text-xs font-semibold text-slate-700"
                        >
                          + Chụp
                        </button>
                        <button
                          type="button"
                          onClick={() => addAssignment(dayIndex, locIndex, "Thợ quay")}
                          className="rounded-lg border bg-white px-2.5 py-1 text-xs font-semibold text-slate-700"
                        >
                          + Quay
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => addLocation(dayIndex)}
                  className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700"
                >
                  + Thêm địa điểm vào ngày này
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="sticky bottom-0 z-20 flex justify-end gap-2 border-t bg-white px-6 py-4 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border px-4 py-2 font-semibold hover:bg-slate-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="rounded-xl bg-blue-600 px-5 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Đang lưu..." : editingJob ? "Cập nhật job" : "Lưu job"}
          </button>
        </div>
      </div>
    </div>
  );
}

// MODAL CHI TIẾT JOB: KHÔI PHỤC CHUẨN GIAO DIỆN CŨ (BẢNG 7 CỘT + SAO CHÉP TỪNG NGÀY + MỞ SĐT)
function JobDetail({ job, onClose, onEdit, onDelete, onReload }: any) {
  const days = job.job_days || [];
  const statusInfo = getJobDetailedStatus(job);

  // Mở/Đóng SĐT cho thợ thủ công
  const toggleContactVisible = async (assignmentId: string, currentVal: boolean) => {
    const nextVal = !currentVal;
    const { error } = await supabase
      .from("job_assignments")
      .update({ contact_visible: nextVal })
      .eq("id", assignmentId);

    if (error) {
      alert("Lỗi khi cập nhật trạng thái SĐT: " + error.message);
      return;
    }

    if (onReload) onReload();
  };

  // Sao chép lịch chụp chi tiết từng ngày
  const copySingleDay = (day: any, dayIndex: number) => {
    const locGroom = (day.job_locations || []).find((l: any) => String(l.location_name || "").toLowerCase().includes("trai")) || {};
    const locBride = (day.job_locations || []).find((l: any) => String(l.location_name || "").toLowerCase().includes("gái")) || {};

    const groomAddr = locGroom.address || job.customers?.address || "";
    const brideAddr = locBride.address || "";

    let text = `Ngày ${dayIndex + 1}${day.note ? ` – ${day.note}` : ""}: ${formatDateVN(day.shooting_date)} • ${day.start_time?.slice(0, 5)} - ${day.end_time?.slice(0, 5)}\n`;
    text += `Địa điểm: Nhà trai: ${groomAddr || "Chưa có"} | Nhà gái: ${brideAddr || "Chưa có"}\n`;

    (day.job_assignments || []).forEach((a: any) => {
      const locName = a.work_location_name || "Địa điểm";
      const empName = a.employees?.full_name || "Chưa chọn";
      const salary = money(a.salary_amount);
      text += `- ${a.role || "Thợ"}: ${empName} (${locName}) | Lương: ${salary}\n`;
    });

    navigator.clipboard.writeText(text);
    alert(`Đã sao chép lịch chụp Ngày ${dayIndex + 1} vào bộ nhớ đệm!`);
  };

  // Sao chép đầy đủ Job
  const copyFullJob = async () => {
    const lines: string[] = [
      `📸 [BEEN MEDIA] - LỊCH CHỤP TOÀN BỘ JOB`,
      `Sự kiện: ${job.event_name || job.customer_name || ""}`,
      `Mã Job: ${job.job_code}`,
      `Gói dịch vụ: ${job.service || ""}`,
      `Khách hàng: ${job.customers?.full_name || job.customer_name || ""}`,
      `SĐT Nhà trai: ${job.customers?.phone || job.customer_phone || "Chưa có"}`,
      `SĐT Nhà gái: ${job.customers?.secondary_phone || job.secondary_phone || "Chưa có"}`,
      `----------------------------------------`,
    ];

    days.forEach((d: any, i: number) => {
      const locGroom = (d.job_locations || []).find((l: any) => String(l.location_name || "").toLowerCase().includes("trai")) || {};
      const locBride = (d.job_locations || []).find((l: any) => String(l.location_name || "").toLowerCase().includes("gái")) || {};

      lines.push(
        `\n📅 Ngày ${i + 1}${d.note ? ` – ${d.note}` : ""}: ${formatDateVN(d.shooting_date)} • ${d.start_time?.slice(0, 5)} - ${d.end_time?.slice(0, 5)}`,
        `📍 Địa điểm: Nhà trai: ${locGroom.address || job.customers?.address || "Chưa cập nhật"} | Nhà gái: ${locBride.address || "Chưa cập nhật"}`
      );

      (d.job_assignments || []).forEach((a: any) => {
        lines.push(
          `- ${a.role || "Thợ"}: ${a.employees?.full_name || "Chưa chọn"} | Lương: ${money(a.salary_amount)}`
        );
      });
    });

    if (job.note) {
      lines.push(`\n📝 Ghi chú chung: ${job.note}`);
    }

    await navigator.clipboard.writeText(lines.join("\n"));
    alert("Đã sao chép đầy đủ Job vào bộ nhớ đệm!");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header dính trên đầu */}
        <div className="sticky top-0 z-20 flex items-center justify-between border-b bg-white px-6 py-4 rounded-t-2xl">
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
            title="Đóng (Esc)"
          >
            ✕
          </button>
        </div>

        {/* Nội dung chi tiết cuộn */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-700 flex-1">
          {/* 4 Thẻ tài chính */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border p-3 bg-white shadow-xs">
              <p className="text-slate-500">Tổng tiền hợp đồng</p>
              <p className="text-lg font-black text-slate-800 mt-1">{money(job.total_price)}</p>
            </div>
            <div className="rounded-xl border p-3 bg-emerald-50/50 shadow-xs">
              <p className="text-slate-500">Đã thanh toán / Cọc</p>
              <p className="text-lg font-black text-emerald-600 mt-1">{money(job.deposit)}</p>
            </div>
            <div className="rounded-xl border p-3 bg-rose-50/50 shadow-xs">
              <p className="text-slate-500">Khách còn nợ</p>
              <p className="text-lg font-black text-rose-600 mt-1">{money(job.debt)}</p>
            </div>
            <div className="rounded-xl border p-3 bg-white shadow-xs">
              <p className="text-slate-500">Số ngày quay/chụp</p>
              <p className="text-lg font-black text-slate-800 mt-1">{days.length}</p>
            </div>
          </div>

          {/* Nhu cầu nhân sự */}
          <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3.5">
            <p className="font-bold text-blue-900 mb-1.5">Nhu cầu nhân sự</p>
            <div className="flex gap-2">
              <span className="rounded-full bg-white border border-blue-200 px-3 py-0.5 text-xs font-semibold text-blue-700 shadow-xs">
                Cần chụp: {job.required_photo_count || 0}
              </span>
              <span className="rounded-full bg-white border border-blue-200 px-3 py-0.5 text-xs font-semibold text-blue-700 shadow-xs">
                Cần quay: {job.required_video_count || 0}
              </span>
            </div>
          </div>

          {/* Danh sách từng ngày chụp - Giao diện bảng 7 cột chuẩn cũ */}
          <div className="space-y-4">
            {days.map((day: any, index: number) => {
              const locGroom = (day.job_locations || []).find((l: any) => String(l.location_name || "").toLowerCase().includes("trai")) || {};
              const locBride = (day.job_locations || []).find((l: any) => String(l.location_name || "").toLowerCase().includes("gái")) || {};

              const groomAddr = locGroom.address || job.customers?.address || "";
              const brideAddr = locBride.address || "";

              return (
                <div key={day.id || index} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
                  {/* Tiêu đề Ngày + Nút Sao chép ngày này */}
                  <div className="flex items-center justify-between border-b pb-2">
                    <h3 className="font-bold text-slate-800 text-sm">
                      Ngày {index + 1}{day.note ? ` – ${day.note}` : ""}: {formatDateVN(day.shooting_date)} • {day.start_time?.slice(0, 5)} - {day.end_time?.slice(0, 5)}
                    </h3>
                    <button
                      type="button"
                      onClick={() => copySingleDay(day, index)}
                      className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1 font-semibold text-blue-600 hover:bg-blue-100 transition-colors"
                    >
                      📋 Sao chép ngày này
                    </button>
                  </div>

                  {/* Tóm tắt Nhà trai | Nhà gái */}
                  <p className="text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">Địa điểm: </span>
                    Nhà trai: {groomAddr || "Chưa cập nhật"} | Nhà gái: {brideAddr || "Chưa cập nhật"}
                  </p>

                  {/* BẢNG 7 CỘT CHI TIẾT */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs min-w-[750px] border rounded-xl overflow-hidden">
                      <thead className="border-b bg-slate-50 text-slate-600 font-semibold">
                        <tr>
                          <th className="p-2.5">Địa điểm</th>
                          <th className="p-2.5">Địa chỉ / SĐT</th>
                          <th className="p-2.5">Vai trò</th>
                          <th className="p-2.5">Thợ</th>
                          <th className="p-2.5">Lương</th>
                          <th className="p-2.5 text-center">SĐT cho thợ</th>
                          <th className="p-2.5">Ghi chú</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y text-slate-700 bg-white">
                        {(day.job_assignments || []).length > 0 ? (
                          (day.job_assignments || []).map((a: any) => {
                            const isGroom = String(a.work_location_name || "").toLowerCase().includes("trai");
                            const address = isGroom ? (groomAddr || a.work_location_address) : (brideAddr || a.work_location_address);
                            const phone = isGroom ? (job.customers?.phone || job.customer_phone) : (job.customers?.secondary_phone || job.secondary_phone);

                            return (
                              <tr key={a.id} className="hover:bg-slate-50/70">
                                <td className="p-2.5 font-bold text-slate-800">
                                  {a.work_location_name || (isGroom ? "Nhà trai" : "Nhà gái")}
                                </td>
                                <td className="p-2.5">
                                  <div className="font-medium text-slate-800">{address || "Chưa nhập địa chỉ"}</div>
                                  {phone && <div className="text-[11px] text-slate-500 font-mono mt-0.5">{phone}</div>}
                                </td>
                                <td className="p-2.5 text-slate-600">{a.role}</td>
                                <td className="p-2.5 font-bold text-slate-900">{a.employees?.full_name || "Chưa xếp thợ"}</td>
                                <td className="p-2.5 font-bold text-slate-800">{money(a.salary_amount)}</td>
                                <td className="p-2.5 text-center">
                                  {a.contact_visible ? (
                                    <button
                                      type="button"
                                      onClick={() => toggleContactVisible(a.id, true)}
                                      className="rounded bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                                      title="Bấm để ẩn SĐT khỏi thợ"
                                    >
                                      Đang mở
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => toggleContactVisible(a.id, false)}
                                      className="rounded bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 border hover:bg-slate-200"
                                      title="Bấm để mở SĐT cho thợ ngay"
                                    >
                                      Mở sớm
                                    </button>
                                  )}
                                </td>
                                <td className="p-2.5 text-slate-500">{a.note || "-"}</td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={7} className="p-3 text-center text-slate-400 italic">
                              Chưa có phân công thợ cho ca này.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer dính */}
        <div className="sticky bottom-0 z-20 flex justify-end gap-2 border-t bg-white px-6 py-4 rounded-b-2xl">
          <button
            onClick={copyFullJob}
            className="rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 shadow-sm"
          >
            📋 Sao chép đầy đủ Job
          </button>
          <button
            onClick={onClose}
            className="rounded-xl border px-4 py-2 font-semibold hover:bg-slate-50"
          >
            Đóng
          </button>
          <button
            onClick={onEdit}
            className="rounded-xl bg-amber-500 px-4 py-2 font-semibold text-white hover:bg-amber-600 shadow-sm"
          >
            Sửa job
          </button>
          <button
            onClick={onDelete}
            className="rounded-xl bg-rose-600 px-4 py-2 font-semibold text-white hover:bg-rose-700 shadow-sm"
          >
            Xóa job
          </button>
        </div>
      </div>
    </div>
  );
}
