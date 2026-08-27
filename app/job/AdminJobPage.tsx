"use client";

import { useEffect, useMemo, useState } from "react";
import MainLayout from "../components/layout/MainLayout";
import { supabase } from "@/lib/supabase";
import MoneyInput from "../components/MoneyInput";
import { formatDateVN } from "@/lib/date-vn";

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

const buildZaloConfirmPayload = (job: any) => {
  const customer = getMainCustomer(job);
  const phone = normalizePhone(customer.phone || job.customer_phone);
  return {
    phone,
    template_data: {
      phone,
      date: formatDateVN(new Date().toISOString().slice(0, 10)),
      address: getJobAddress(job),
      price: Number(job.debt || job.total_price || 0),
      event_date: getEventDateText(job),
      name: customer.full_name || job.customer_name || "Quý khách",
      service_package: job.service || "",
      phone_number: phone,
      customer_name: job.event_name || customer.full_name || job.customer_name || "",
    },
  };
};

const buildZaloReviewPayload = (job: any) => {
  const customer = getMainCustomer(job);
  const firstDay = getFirstJobDay(job);
  return {
    phone: normalizePhone(customer.phone || job.customer_phone),
    template_data: {
      phone: normalizePhone(customer.phone || job.customer_phone),
      order_code: job.service || job.job_code || "",
      order_date: formatDateVN(firstDay.shooting_date),
      $zReqId: "",
      $zReqTime: "",
      customer_name: job.event_name || customer.full_name || job.customer_name || "",
    },
  };
};


type QuickJobPreview={shooting_date?:string;start_time?:string;event_name?:string;groom_name?:string;bride_name?:string;groom_phone?:string;bride_phone?:string;groom_address?:string;bride_address?:string;location?:string;note?:string};
const qTime=(h?:string,m?:string)=>h?`${String(Math.min(23,Number(h))).padStart(2,"0")}:${String(Math.min(59,Number(m||0))).padStart(2,"0")}`:"";
const qPhone=(s:string)=>s.replace(/\D/g,"");
function parseQuickJob(raw:string,baseMonth:string):QuickJobPreview{
 const text=raw.replace(/\s+/g," ").trim(),lower=text.toLowerCase(),o:QuickJobPreview={note:text};
 const df=lower.match(/\b([0-3]?\d)[\/-]([01]?\d)(?:[\/-](20\d{2}|\d{2}))?\b/),dd=lower.match(/^\s*([0-3]?\d)\s*[:\-]/);
 if(df){let y=df[3]?Number(df[3]):Number(baseMonth.slice(0,4));if(y<100)y+=2000;o.shooting_date=`${y}-${String(Number(df[2])).padStart(2,"0")}-${String(Number(df[1])).padStart(2,"0")}`}
 else if(dd)o.shooting_date=`${baseMonth}-${String(Number(dd[1])).padStart(2,"0")}`;
 const tm=lower.match(/\b([01]?\d|2[0-3])\s*(?:h|:)\s*([0-5]?\d)?\b/);if(tm)o.start_time=qTime(tm[1],tm[2]);
 if(/ăn hỏi|an hoi/.test(lower))o.event_name=/quay/.test(lower)?"Quay ăn hỏi":"Chụp ăn hỏi";else if(/rước dâu|ruoc dau/.test(lower))o.event_name=/quay/.test(lower)?"Quay rước dâu":"Chụp rước dâu";
 const nm=text.match(/tên\s*\(\s*([^+()]+)\s*\+\s*([^()]+)\)/i);if(nm){o.groom_name=nm[1].trim();o.bride_name=nm[2].trim()}
 const ph=[...text.matchAll(/(?:\+?84|0)[\d.\s-]{8,14}\d/g)].map(x=>qPhone(x[0])).filter(x=>x.length>=9&&x.length<=11);o.groom_phone=ph[0];o.bride_phone=ph[1];
 const ba=text.match(/nhà\s*(?:cô\s*dâu|gái)\s*[:\-]?\s*([^()]+)/i),ga=text.match(/nhà\s*(?:chú\s*rể|trai)\s*[:\-]?\s*([^()]+)/i),ad=text.match(/địa\s*chỉ[.:]?\s*([^()]+)/i);
 if(ba)o.bride_address=ba[1].trim();if(ga)o.groom_address=ga[1].trim();if(ad)o.location=ad[1].trim();return o;
}

export default function AdminJobPage() {
  const [showQuickJob,setShowQuickJob]=useState(false); const [quickText,setQuickText]=useState(""); const [quickPreview,setQuickPreview]=useState<QuickJobPreview|null>(null);

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
  const [statusTab, setStatusTab] = useState<"all"|"completed"|"incomplete">("all");
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [filterMonth, setFilterMonth] = useState<"all"|number>("all");
  const [filterEmployee, setFilterEmployee] = useState("");
  const quickBaseMonth = `${filterYear}-${String(filterMonth === "all" ? new Date().getMonth()+1 : filterMonth).padStart(2,"0")}`;

  const [offlineDraftCount, setOfflineDraftCount] = useState(0);

  const requestPin = async (action = "thao tác này") => {
    const { data } = await supabase.from("app_settings").select("value").eq("id", "edit_pin").maybeSingle();
    const pin = data?.value || "2580";
    const entered = window.prompt(`Nhập PIN để ${action}:`);
    if (entered === null) return false;
    if (entered !== pin) { alert("PIN không đúng"); return false; }
    return true;
  };

  const refreshOfflineCount = () => {
    try { setOfflineDraftCount(JSON.parse(localStorage.getItem("been_offline_job_drafts") || "[]").length); } catch { setOfflineDraftCount(0); }
  };

  async function loadData() {
    setLoading(true);
    const [{ data: jobData, error: jobError }, { data: customerData }, { data: empData }, { data: reserveData }] = await Promise.all([
      supabase
        .from("jobs")
        .select("*, customers(*), job_days(*, job_assignments(*, employees(*)))")
        .order("created_at", { ascending: false }),
      supabase.from("customers").select("*").order("created_at", { ascending: false }),
      supabase.from("employees").select("*").eq("active", true).order("full_name", { ascending: true }),
      supabase.from("reserve_workers").select("*, employees(*)").eq("status","reserved").order("reserve_date", { ascending: true }),
    ]);
    setLoading(false);

    if (jobError) {
      alert(jobError.message);
      return;
    }

    setJobs(jobData || []);
    setCustomers(customerData || []);
    setEmployees(empData || []);
    setReserveWorkers(reserveData || []);
  }

  useEffect(() => {
    loadData();
    refreshOfflineCount();
  }, []);

  useEffect(() => {
    if (!employees.length || typeof window === "undefined") return;
    const raw = localStorage.getItem("been_ai_job_draft");
    if (!raw) return;
    localStorage.removeItem("been_ai_job_draft");
    try {
      const d = JSON.parse(raw);
      const existing = customers.find((c:any) => (d.phone && normalizePhone(c.phone) === normalizePhone(d.phone)) || (d.customer_name && String(c.full_name||"").toLowerCase() === String(d.customer_name).toLowerCase()));
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
        ...emptyJob, event_name:d.event_name||"", booking_date:d.booking_date||new Date().toISOString().slice(0,10), service:d.service||"Combo VIP", total_price:Number(d.total_price||0), deposit:Number(d.deposit||0), location:d.address||"", note:d.note||""
      });
      const ass=(d.assignments||[]).map((a:any)=>{
        const wanted=String(a.employee_name||"").trim().toLowerCase();
        const emp=wanted ? employees.find((e:any)=>{ const n=String(e.full_name||"").trim().toLowerCase(); return n===wanted || n.includes(wanted) || wanted.includes(n); }) : undefined;
        return { employee_id:emp?.id||"", role:a.role||"Thợ chụp", salary_amount:Number(a.salary_amount||((a.role||"").includes("quay")?900000:700000)), note:a.note||"", client_requested:Boolean(a.client_requested), contact_visible:Boolean(a.contact_visible) };
      });
      setDays([{ shooting_date:d.shooting_date||"", start_time:d.start_time||"07:00", end_time:d.end_time||"11:00", note:d.note||"", locations:[{ location_name:d.location_name||"Địa điểm", address:d.address||"", phone:d.location_phone||"", note:d.note||"", assignments:ass.length?ass:[makeAssignment("Thợ chụp")] }] }]);
      setOpenForm(true);
      alert("AI đã điền trước Job. Hãy kiểm tra lại trước khi bấm Lưu Job.");
    } catch { /* bỏ qua draft lỗi */ }
  }, [employees, customers]);

  useEffect(()=>{
    if(!jobs.length || typeof window === "undefined") return;
    const id=new URLSearchParams(window.location.search).get("open");
    if(id){ const found=jobs.find((j:any)=>j.id===id); if(found) setSelectedJob(found); }
  },[jobs]);

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
      const groups: any = {};

      (day.job_assignments || []).forEach((assignment: any) => {
        const key = [
          assignment.work_location_name || day.location || "Địa điểm",
          assignment.work_location_address || "",
          assignment.work_location_phone || "",
        ].join("__");

        if (!groups[key]) {
          groups[key] = {
            location_name: assignment.work_location_name || day.location || "Địa điểm",
            address: assignment.work_location_address || "",
            phone: assignment.work_location_phone || "",
            note: "",
            assignments: [],
          };
        }

        groups[key].assignments.push({
          employee_id: assignment.employee_id || "",
          role: assignment.role || "Thợ chụp",
          salary_amount: Number(assignment.salary_amount || 0),
          note: assignment.note || "",
          client_requested: Boolean(assignment.client_requested),
          contact_visible: Boolean(assignment.contact_visible),
        });
      });

      const locations = Object.values(groups);

      return {
        shooting_date: day.shooting_date || "",
        start_time: day.start_time || "07:00",
        end_time: day.end_time || "11:00",
        note: day.note || "",
        locations: locations.length ? locations : [makeLocation(day.location || "Địa điểm")],
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

  const addReservedWorker = (dayIndex: number, locationIndex: number, reserve: any) => {
    const emp = employees.find((x:any)=>x.id===reserve.employee_id) || reserve.employees;
    setDays((prev) => prev.map((day, i) => {
      if (i !== dayIndex) return day;
      return {...day, locations: day.locations.map((loc:any,j:number)=>j===locationIndex?{...loc, assignments:[...loc.assignments, {employee_id: reserve.employee_id, role: reserve.role || emp?.role || "Thợ chụp", salary_amount: Number(emp?.base_fee || (String(reserve.role).includes("quay") ? 900000 : 700000)), note: "Thêm từ thợ dự phòng", client_requested: false, contact_visible: false}]}:loc)};
    }));
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

  const saveOfflineDraft = () => {
    const item = { id: `OFFLINE-${Date.now()}`, saved_at: new Date().toISOString(), customerForm, jobForm, days };
    const list = JSON.parse(localStorage.getItem("been_offline_job_drafts") || "[]");
    list.push(item);
    localStorage.setItem("been_offline_job_drafts", JSON.stringify(list));
    refreshOfflineCount();
    setOpenForm(false);
    alert("Đã lưu Job vào máy ở trạng thái CHƯA ĐỒNG BỘ. Khi có mạng, vào Job và bấm 'Mở bản nháp offline' để kiểm tra rồi Lưu Job.");
  };

  const restoreOfflineDraft = () => {
    try {
      const list = JSON.parse(localStorage.getItem("been_offline_job_drafts") || "[]");
      const item = list.pop();
      if (!item) return alert("Không có bản nháp offline");
      localStorage.setItem("been_offline_job_drafts", JSON.stringify(list));
      setEditingJob(null); setCustomerForm(item.customerForm); setJobForm(item.jobForm); setDays(item.days); setOpenForm(true); refreshOfflineCount();
    } catch { alert("Không đọc được bản nháp offline"); }
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
    if (!jobForm.service.trim()) {
      alert("Vui lòng nhập gói dịch vụ");
      return;
    }
    if (days.some((day) => !day.shooting_date)) {
      alert("Vui lòng nhập đầy đủ ngày chụp");
      return;
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) { saveOfflineDraft(); return; }

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
            .map((loc: any) => `${loc.location_name}: ${loc.address}`)
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
            const { error: assignmentError } = await supabase
              .from("job_assignments")
              .insert(assignmentRows);
            if (assignmentError) throw assignmentError;
          }
        }

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
          .map((loc: any) => `${loc.location_name}: ${loc.address}`)
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
      alert((error.message || "Không lưu được job") + (createdJobIdForRollback ? "\nJob lỗi đã được tự động hoàn tác, không tạo bản trùng." : ""));
    } finally {
      setSaving(false);
    }
  }

  async function deleteJob(id: string) {
    if (!(await requestPin("xóa Job"))) return;
    if (!confirm("Bạn chắc chắn muốn xóa job này? Thao tác này sẽ xóa ngày chụp và phân công liên quan.")) return;
    const { error } = await supabase.from("jobs").delete().eq("id", id);
    if (error) return alert(error.message);
    setSelectedJob(null);
    loadData();
  }

  const totals = useMemo(() => {
    const revenue = jobs.reduce((sum, job) => sum + Number(job.total_price || 0), 0);
    const deposit = jobs.reduce((sum, job) => sum + Number(job.deposit || 0), 0);
    const debt = jobs.reduce((sum, job) => sum + Number(job.debt || 0), 0);
    const salary = jobs.reduce(
      (sum, job) =>
        sum +
        (job.job_days || []).reduce(
          (daySum: number, day: any) =>
            daySum + (day.job_assignments || []).reduce((aSum: number, a: any) => aSum + Number(a.salary_amount || 0), 0),
          0
        ),
      0
    );
    return { revenue, deposit, debt, salary };
  }, [jobs]);

  const years = useMemo(() => {
    const ys = new Set<number>([new Date().getFullYear()]);
    jobs.forEach((j:any)=>(j.job_days||[]).forEach((d:any)=>{ const y=Number(String(d.shooting_date||"").slice(0,4)); if(y) ys.add(y); }));
    return Array.from(ys).sort((a,b)=>b-a);
  }, [jobs]);

  const periodJobs = useMemo(() => jobs.filter((job:any) => {
    const ds=(job.job_days||[]).map((d:any)=>String(d.shooting_date||""));
    if(!ds.length) return filterMonth==="all";
    return ds.some((v:string)=> Number(v.slice(0,4))===filterYear && (filterMonth==="all" || Number(v.slice(5,7))===filterMonth));
  }), [jobs,filterYear,filterMonth]);

  const filteredJobs = useMemo(() => {
    const q=search.trim().toLowerCase();
    return periodJobs.filter((job:any)=>{
      const completed=["hoàn thành","đã bàn giao"].includes(String(job.status||"").toLowerCase());
      if(statusTab==="completed"&&!completed) return false;
      if(statusTab==="incomplete"&&completed) return false;
      const assigns=(job.job_days||[]).flatMap((d:any)=>d.job_assignments||[]);
      if(filterEmployee && !assigns.some((a:any)=>a.employee_id===filterEmployee)) return false;
      const text=[job.job_code,job.event_name,job.customer_name,job.customer_phone,job.customers?.full_name,job.customers?.phone,job.service,...assigns.map((a:any)=>a.employees?.full_name)].join(" ").toLowerCase();
      return !q||text.includes(q);
    });
  },[periodJobs,statusTab,filterEmployee,search]);

  const periodTotals = useMemo(()=>({
    total:periodJobs.length,
    completed:periodJobs.filter((j:any)=>["hoàn thành","đã bàn giao"].includes(String(j.status||"").toLowerCase())).length,
    incomplete:periodJobs.filter((j:any)=>!["hoàn thành","đã bàn giao"].includes(String(j.status||"").toLowerCase())).length,
    revenue:periodJobs.reduce((s:number,j:any)=>s+Number(j.total_price||0),0),
    debt:periodJobs.reduce((s:number,j:any)=>s+Math.max(Number(j.debt||0),0),0),
    salary:periodJobs.reduce((s:number,j:any)=>s+(j.job_days||[]).reduce((ds:number,d:any)=>ds+(d.job_assignments||[]).reduce((as:number,a:any)=>as+Number(a.salary_amount||0),0),0),0)
  }),[periodJobs]);

  return (
    <MainLayout>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div><h1 className="text-3xl font-bold">Job / Booking</h1><p className="text-gray-500 mt-1">Tìm, lọc theo năm/tháng, xem ekip và trạng thái hoàn thành.</p></div>
        <div className="flex flex-wrap gap-2"><button onClick={openCreate} className="bg-blue-600 text-white px-5 py-3 rounded-xl">+ Tạo job mới</button>{offlineDraftCount>0&&<button onClick={restoreOfflineDraft} className="rounded-xl bg-amber-500 px-4 py-3 font-semibold text-white">Mở bản nháp offline ({offlineDraftCount})</button>}</div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-6">
        <div className="bg-white rounded-xl p-4 shadow"><p className="text-gray-500">Job tổng</p><p className="text-2xl font-bold">{periodTotals.total}</p></div>
        <div className="bg-white rounded-xl p-4 shadow"><p className="text-gray-500">Đã hoàn thành</p><p className="text-2xl font-bold text-emerald-700">{periodTotals.completed}</p></div>
        <div className="bg-white rounded-xl p-4 shadow"><p className="text-gray-500">Chưa hoàn thành</p><p className="text-2xl font-bold text-amber-600">{periodTotals.incomplete}</p></div>
        <div className="bg-white rounded-xl p-4 shadow"><p className="text-gray-500">Doanh thu</p><p className="text-xl font-bold">{money(periodTotals.revenue)}</p></div>
        <div className="bg-white rounded-xl p-4 shadow"><p className="text-gray-500">Khách còn nợ</p><p className="text-xl font-bold text-red-600">{money(periodTotals.debt)}</p></div>
        <div className="bg-white rounded-xl p-4 shadow"><p className="text-gray-500">Lương thợ</p><p className="text-xl font-bold text-orange-600">{money(periodTotals.salary)}</p></div>
      </div>
      <div className="mb-5 rounded-2xl bg-white p-4 shadow-sm"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5"><label className="text-sm font-medium">Tìm kiếm<input value={search} onChange={e=>setSearch(e.target.value)} className="mt-1 w-full rounded-xl border p-3" placeholder="Tên khách, SĐT, sự kiện, mã Job..."/></label><label className="text-sm font-medium">Năm<select value={filterYear} onChange={e=>setFilterYear(Number(e.target.value))} className="mt-1 w-full rounded-xl border p-3">{years.map(y=><option key={y}>{y}</option>)}</select></label><label className="text-sm font-medium">Tháng<select value={filterMonth} onChange={e=>setFilterMonth(e.target.value==='all'?'all':Number(e.target.value))} className="mt-1 w-full rounded-xl border p-3"><option value="all">Cả năm</option>{Array.from({length:12},(_,i)=><option key={i+1} value={i+1}>Tháng {i+1}</option>)}</select></label><label className="text-sm font-medium">Lọc theo thợ<select value={filterEmployee} onChange={e=>setFilterEmployee(e.target.value)} className="mt-1 w-full rounded-xl border p-3"><option value="">Tất cả thợ</option>{employees.map((e:any)=><option key={e.id} value={e.id}>{e.full_name}</option>)}</select></label><div className="flex items-end gap-2">{([["all","Job tổng"],["completed","Đã xong"],["incomplete","Chưa xong"]] as const).map(([k,l])=><button key={k} onClick={()=>setStatusTab(k)} className={`flex-1 rounded-xl px-3 py-3 text-sm font-semibold ${statusTab===k?'bg-blue-600 text-white':'border bg-white'}`}>{l}</button>)}</div></div></div>

      <div className="bg-white rounded-xl shadow p-6 overflow-x-auto">
        <table className="w-full min-w-[1200px]">
          <thead>
            <tr className="border-b bg-slate-50">
              <th className="text-left p-3">Mã job</th>
              <th className="text-left p-3">Sự kiện</th>
              <th className="text-left p-3">Khách hàng</th>
              <th className="text-left p-3">Dịch vụ</th>
              <th className="text-left p-3">Ngày chụp</th>
              <th className="text-left p-3">Doanh thu</th>
              <th className="text-left p-3">Còn nợ</th>
              <th className="text-left p-3">Lương thợ</th>
              <th className="text-left p-3">Ekip</th>
              <th className="text-left p-3">Trạng thái</th>
              <th className="text-left p-3">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td className="p-4 text-gray-500" colSpan={11}>Đang tải job...</td></tr>}
            {!loading && jobs.length === 0 && <tr><td className="p-4 text-gray-500" colSpan={11}>Chưa có job. Bấm “Tạo job mới”.</td></tr>}
            {filteredJobs.map((job) => {
              const salary = (job.job_days || []).reduce(
                (sum: number, day: any) => sum + (day.job_assignments || []).reduce((s: number, a: any) => s + Number(a.salary_amount || 0), 0),
                0
              );
              return (
                <tr key={job.id} className="border-b hover:bg-slate-50">
                  <td className="p-3 font-semibold">{job.job_code}</td>
                  <td className="p-3 font-semibold">{job.event_name || "Chưa đặt tên"}</td>
                  <td className="p-3">
                    <div className="font-semibold">{job.customers?.full_name || "Chưa chọn"}</div>
                    <div className="text-xs text-gray-500">{job.customers?.phone}</div>
                    {job.customers?.secondary_phone && <div className="text-xs text-gray-500">Phụ: {job.customers.secondary_phone}</div>}
                  </td>
                  <td className="p-3">{job.service}</td>
                  <td className="p-3">{(job.job_days || []).map((d: any) => d.shooting_date).join(", ")}</td>
                  <td className="p-3">{money(job.total_price)}</td>
                  <td className="p-3 text-red-600">{money(job.debt)}</td>
                  <td className="p-3 text-orange-600">{money(salary)}</td>
                  <td className="p-3"><div className="flex max-w-[300px] flex-wrap gap-1">{Array.from(new Map((job.job_days||[]).flatMap((d:any)=>d.job_assignments||[]).filter((a:any)=>a.employee_id).map((a:any)=>[a.employee_id,a])).values()).slice(0,5).map((a:any)=><span key={a.employee_id} className={`rounded-full px-2 py-1 text-xs ${a.client_requested?'bg-red-100 font-bold text-red-700':'bg-slate-100'}`}>{a.client_requested?'⭐ ':''}{a.employees?.full_name||'Thợ'} • {a.role}</span>)}</div></td>
                  <td className="p-3"><span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm">{job.status}</span></td>
                  <td className="p-3 whitespace-nowrap">
                    <button onClick={() => setSelectedJob(job)} className="bg-slate-800 text-white px-3 py-1 rounded mr-2">Xem</button>
                    <button onClick={() => openEdit(job)} className="bg-yellow-500 text-white px-3 py-1 rounded mr-2">Sửa</button>
                    <button onClick={() => deleteJob(job.id)} className="bg-red-600 text-white px-3 py-1 rounded">Xóa</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {openForm && (
        <JobForm
          customers={customers}
          employees={employees}
          reserveWorkers={reserveWorkers}
          customerForm={customerForm}
          setCustomerForm={setCustomerForm}
          jobForm={jobForm}
          setJobForm={setJobForm}
          days={days}
          updateDay={updateDay}
          addDay={addDay}
          duplicateDay={duplicateDay}
          removeDay={removeDay}
          addReservedWorker={addReservedWorker}
          addLocation={addLocation}
          updateLocation={updateLocation}
          removeLocation={removeLocation}
          updateAssignment={updateAssignment}
          addAssignment={addAssignment}
          removeAssignment={removeAssignment}
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
          onEdit={() => {
            setSelectedJob(null);
            openEdit(selectedJob);
          }}
          onDelete={() => deleteJob(selectedJob.id)}
        />
      )}
    
{showQuickJob&&<div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
        <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div><h2 className="text-xl font-bold">Nhập Job nhanh</h2><p className="text-sm text-slate-500">Dán tin nhắn khách. Phân công thợ vẫn nhập thủ công.</p></div>
            <button onClick={()=>setShowQuickJob(false)} className="rounded-lg border px-3 py-2">✕</button>
          </div>
          <textarea value={quickText} onChange={e=>setQuickText(e.target.value)} rows={7} className="w-full rounded-2xl border p-4" placeholder="Ví dụ: 19: 6h chụp ăn hỏi... Tên( Quân + Yến ) - số điện thoại..."/>
          <button onClick={()=>setQuickPreview(parseQuickJob(quickText,quickBaseMonth))} disabled={!quickText.trim()} className="mt-3 w-full rounded-xl bg-blue-600 p-3 font-bold text-white disabled:opacity-40">Phân tích thông tin</button>
          {quickPreview&&<div className="mt-4 rounded-2xl bg-slate-50 p-4">
            <h3 className="mb-3 font-bold">Kiểm tra thông tin nhận được</h3>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <p><b>Ngày:</b> {formatDateVN(quickPreview.shooting_date)||"Chưa nhận"}</p>
              <p><b>Giờ 24h:</b> {quickPreview.start_time||"Chưa nhận"}</p>
              <p><b>Loại:</b> {quickPreview.event_name||"Chưa nhận"}</p>
              <p><b>Chú rể:</b> {quickPreview.groom_name||"Chưa nhận"}</p>
              <p><b>Cô dâu:</b> {quickPreview.bride_name||"Chưa nhận"}</p>
              <p><b>SĐT chú rể:</b> {quickPreview.groom_phone||"Chưa nhận"}</p>
              <p><b>SĐT cô dâu:</b> {quickPreview.bride_phone||"Chưa nhận"}</p>
              <p><b>Địa điểm:</b> {quickPreview.location||"Chưa nhận"}</p>
              <p><b>Nhà cô dâu:</b> {quickPreview.bride_address||"Chưa nhận"}</p>
              <p><b>Nhà chú rể:</b> {quickPreview.groom_address||"Chưa nhận"}</p>
            </div>
            <button onClick={()=>{
              const q=quickPreview;
              setEditingJob(null);
              setCustomerForm((c:any)=>({
                ...c,
                full_name:[q.groom_name,q.bride_name].filter(Boolean).join(" + ")||c.full_name,
                phone:q.groom_phone||c.phone,
                secondary_phone:q.bride_phone||c.secondary_phone,
                address:q.location||q.groom_address||q.bride_address||c.address,
              }));
              setJobForm((j:any)=>({
                ...j,
                event_name:q.event_name||[q.groom_name,q.bride_name].filter(Boolean).join(" + ")||j.event_name,
                location:q.location||j.location,
                note:[
                  j.note,
                  q.bride_address?`Nhà cô dâu: ${q.bride_address}`:"",
                  q.groom_address?`Nhà chú rể: ${q.groom_address}`:"",
                  `Tin gốc: ${quickText}`
                ].filter(Boolean).join("\n")
              }));
              setDays((prev:any[])=>{
                const first=prev?.[0]||makeDay();
                const locs=[...(first.locations||[])];
                if(locs[0]&&q.groom_address) locs[0]={...locs[0],location_name:"Nhà chú rể",address:q.groom_address,phone:q.groom_phone||locs[0].phone};
                if(locs[1]&&q.bride_address) locs[1]={...locs[1],location_name:"Nhà cô dâu",address:q.bride_address,phone:q.bride_phone||locs[1].phone};
                return [{...first,shooting_date:q.shooting_date||first.shooting_date,start_time:q.start_time||first.start_time,locations:locs}];
              });
              setShowQuickJob(false);
              setOpenForm(true);
            }} className="mt-4 w-full rounded-xl bg-emerald-600 p-3 font-bold text-white">Đưa vào form Job để kiểm tra</button>
          </div>}
          <p className="mt-3 text-xs text-slate-500">Chuẩn 24 tiếng: 6h → 06:00 • 14h30 → 14:30. Hệ thống không tự phân công nhân sự.</p>
        </div>
      </div>}
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
    jobForm,
    setJobForm,
    days,
    updateDay,
    addDay,
    duplicateDay,
    removeDay,
    addReservedWorker,
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

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-7xl p-6 shadow-xl max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-5">
          <div>
            <h2 className="text-2xl font-bold">{editingJob ? "Sửa Job / Booking" : "Tạo khách + Job + phân công thợ"}</h2>
            <p className="text-gray-500 text-sm">Ví dụ: TUẤN BEEN & THU THỦY, 2 ngày, chia nhà trai / nhà gái, phân công từng thợ từng địa chỉ</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-red-600">✕</button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="border rounded-xl p-4 space-y-3">
            <h3 className="font-bold text-lg">1. Khách hàng</h3>
            <label className="block text-sm font-medium text-slate-700">Chọn khách hàng CRM
            <select
              className="mt-1 border p-3 rounded-lg w-full"
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
                  facebook: customer?.facebook || "",
                });
              }}
            >
              <option value="">Khách mới hoặc chọn khách CRM</option>
              {customers.map((customer: any) => (
                <option key={customer.id} value={customer.id}>{customer.full_name} - {customer.phone}</option>
              ))}
            </select></label>
            <label className="block text-sm font-medium text-slate-700">Tên khách đại diện / người book<input className="mt-1 border p-3 rounded-lg w-full" placeholder="Ví dụ: Nguyễn Văn A" value={customerForm.full_name} onChange={(e) => setCustomerForm({ ...customerForm, full_name: e.target.value })} /></label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-sm font-medium text-slate-700">SĐT chính<input className="mt-1 border p-3 rounded-lg w-full" placeholder="058..." value={customerForm.phone} onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })} /></label>
              <label className="text-sm font-medium text-slate-700">SĐT phụ / SĐT cô dâu<input className="mt-1 border p-3 rounded-lg w-full" placeholder="SĐT phụ" value={customerForm.secondary_phone} onChange={(e) => setCustomerForm({ ...customerForm, secondary_phone: e.target.value })} /></label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input className="border p-3 rounded-lg" placeholder="Email" value={customerForm.email} onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })} />
              <input className="border p-3 rounded-lg" placeholder="Facebook/Zalo" value={customerForm.facebook} onChange={(e) => setCustomerForm({ ...customerForm, facebook: e.target.value })} />
            </div>
            <input className="border p-3 rounded-lg w-full" placeholder="Địa chỉ khách đại diện" value={customerForm.address} onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })} />
          </div>

          <div className="border rounded-xl p-4 space-y-3">
            <h3 className="font-bold text-lg">2. Booking / Thanh toán</h3>
            <input className="border p-3 rounded-lg w-full" placeholder="Tên sự kiện / tên dâu rể. Ví dụ: TUẤN BEEN & THU THỦY" value={jobForm.event_name} onChange={(e) => setJobForm({ ...jobForm, event_name: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm text-gray-600">Ngày khách đặt lịch<input type="date" className="border p-3 rounded-lg w-full mt-1" value={jobForm.booking_date} onChange={(e) => setJobForm({ ...jobForm, booking_date: e.target.value })} /></label>
              <label className="text-sm text-gray-600">Trạng thái<select className="border p-3 rounded-lg w-full mt-1" value={jobForm.status} onChange={(e) => setJobForm({ ...jobForm, status: e.target.value })}><option>Chưa chốt</option><option>Đã đặt cọc</option><option>Đang chụp</option><option>Đang hậu kỳ</option><option>Đã bàn giao</option><option>Hoàn thành</option><option>Hủy</option></select></label>
            </div>
            <input className="border p-3 rounded-lg w-full" placeholder="Gói dịch vụ. Ví dụ: Combo VIP - 3 chụp 2 quay" value={jobForm.service} onChange={(e) => setJobForm({ ...jobForm, service: e.target.value })} />
            <input className="border p-3 rounded-lg w-full" placeholder="Địa điểm chung / ghi chú địa bàn" value={jobForm.location} onChange={(e) => setJobForm({ ...jobForm, location: e.target.value })} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="text-sm font-medium text-gray-700">
                Tổng tiền hợp đồng
                <MoneyInput className="border p-3 rounded-lg w-full mt-1" placeholder="Ví dụ: 10.000.000" value={jobForm.total_price} onChange={(v) => setJobForm({ ...jobForm, total_price: v })} />
                <span className="block text-xs text-gray-500 mt-1">Nhập tổng giá trị khách phải thanh toán.</span>
              </label>
              <label className="text-sm font-medium text-gray-700">
                Đã thu / Đặt cọc
                <MoneyInput className="border p-3 rounded-lg w-full mt-1" placeholder="Ví dụ: 3.000.000" value={jobForm.deposit} onChange={(v) => setJobForm({ ...jobForm, deposit: v })} />
                <span className="block text-xs text-gray-500 mt-1">Nhập số tiền khách đã thanh toán hoặc đặt cọc.</span>
              </label>
              <label className="text-sm font-medium text-gray-700">
                Còn nợ khách
                <input readOnly className="border p-3 rounded-lg bg-gray-50 w-full mt-1 font-semibold" value={Number(jobForm.total_price || 0) - Number(jobForm.deposit || 0)} />
                <span className="block text-xs text-gray-500 mt-1">Tự động tính = Tổng tiền − Đã thu. Không cần nhập.</span>
              </label>
            </div>
            <textarea className="border p-3 rounded-lg w-full" placeholder="Ghi chú job" value={jobForm.note} onChange={(e) => setJobForm({ ...jobForm, note: e.target.value })} />
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg">3. Ngày chụp → Địa điểm → Phân công thợ</h3>
            <button onClick={addDay} className="bg-slate-800 text-white px-4 py-2 rounded-lg">+ Thêm ngày chụp</button>
          </div>

          {days.map((day: any, dayIndex: number) => (
            <div key={dayIndex} className="border rounded-xl p-4 bg-slate-50 space-y-4">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <div className="font-bold text-slate-800">Ngày chụp {dayIndex + 1}</div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => duplicateDay(dayIndex)} className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-blue-700">📋 Sao chép ngày</button>
                  {days.length>1&&<button type="button" onClick={() => removeDay(dayIndex)} className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-red-600">Xóa ngày</button>}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                <label className="text-sm text-gray-600">Ngày thực hiện<input type="date" className="border p-3 rounded-lg w-full mt-1" value={day.shooting_date} onChange={(e) => updateDay(dayIndex, "shooting_date", e.target.value)} /></label>
                <label className="text-sm text-gray-600">Từ giờ<input type="time" lang="vi-VN" className="border p-3 rounded-lg w-full mt-1" value={day.start_time} onChange={(e) => updateDay(dayIndex, "start_time", e.target.value)} /></label>
                <label className="text-sm text-gray-600">Đến giờ<input type="time" lang="vi-VN" className="border p-3 rounded-lg w-full mt-1" value={day.end_time} onChange={(e) => updateDay(dayIndex, "end_time", e.target.value)} /></label>
                <label className="text-sm text-gray-600">Ghi chú ngày<input className="border p-3 rounded-lg w-full mt-1" value={day.note} onChange={(e) => updateDay(dayIndex, "note", e.target.value)} placeholder="Ăn hỏi / tiệc / lưu ý timeline..." /></label>
              </div>

              <div className="flex justify-between items-center">
                <p className="font-semibold">Các địa điểm trong ngày này</p>
                <button onClick={() => addLocation(dayIndex)} className="bg-blue-600 text-white px-3 py-2 rounded-lg">+ Thêm địa chỉ / nhà gái</button>
              </div>

              {day.shooting_date && reserveWorkers.filter((r:any)=>r.reserve_date===day.shooting_date).length>0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <p className="mb-2 text-sm font-bold text-amber-900">Thợ dự phòng ngày {formatDateVN(day.shooting_date)} — bấm tên để thêm nhanh vào địa điểm bên dưới</p>
                  <div className="flex flex-wrap gap-2">{reserveWorkers.filter((r:any)=>r.reserve_date===day.shooting_date).map((r:any)=><span key={r.id} className="rounded-full bg-white px-3 py-1 text-sm ring-1 ring-amber-200">{r.employees?.full_name||"Nhân sự"} • {r.role}</span>)}</div>
                </div>
              )}

              {day.locations.map((location: any, locationIndex: number) => (
                <div key={locationIndex} className="border rounded-xl p-4 bg-white space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                    <label className="text-sm text-gray-600 md:col-span-3">Tên địa điểm / nhà
                      <input className="border p-2 rounded-lg w-full mt-1" value={location.location_name} onChange={(e) => updateLocation(dayIndex, locationIndex, "location_name", e.target.value)} placeholder="Nhà trai / Nhà gái / Nhà hàng" />
                    </label>
                    <label className="text-sm text-gray-600 md:col-span-5">Địa chỉ
                      <input className="border p-2 rounded-lg w-full mt-1" value={location.address} onChange={(e) => updateLocation(dayIndex, locationIndex, "address", e.target.value)} placeholder="Xóm 1 Hoàng Xá / Giáp Long..." />
                    </label>
                    <label className="text-sm text-gray-600 md:col-span-3">SĐT tại địa điểm
                      <input className="border p-2 rounded-lg w-full mt-1" value={location.phone} onChange={(e) => updateLocation(dayIndex, locationIndex, "phone", e.target.value)} placeholder="0585557555" />
                    </label>
                    <button onClick={() => removeLocation(dayIndex, locationIndex)} className="text-red-600 md:col-span-1 pb-2">X</button>
                  </div>

                  {day.shooting_date && reserveWorkers.filter((r:any)=>r.reserve_date===day.shooting_date).length>0&&<div className="rounded-lg bg-amber-50 p-2"><p className="mb-2 text-xs font-bold text-amber-800">+ Thêm thợ dự phòng vào {location.location_name||"địa điểm này"}</p><div className="flex flex-wrap gap-2">{reserveWorkers.filter((r:any)=>r.reserve_date===day.shooting_date).map((r:any)=><button type="button" key={r.id} onClick={()=>addReservedWorker(dayIndex,locationIndex,r)} className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-900">+ {r.employees?.full_name||"Nhân sự"} • {r.role}</button>)}</div></div>}

                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => addAssignment(dayIndex, locationIndex, "Thợ chụp")} className="border px-3 py-1 rounded">+ Chụp</button>
                    <button onClick={() => addAssignment(dayIndex, locationIndex, "Thợ quay")} className="border px-3 py-1 rounded">+ Quay</button>
                    <button onClick={() => addAssignment(dayIndex, locationIndex, "Flycam")} className="border px-3 py-1 rounded">+ Flycam</button>
                    <button onClick={() => addAssignment(dayIndex, locationIndex, "Editor")} className="border px-3 py-1 rounded">+ Editor</button>
                  </div>

                  <div className="space-y-2">
                    {location.assignments.map((assignment: any, assignmentIndex: number) => (
                      <div key={assignmentIndex} className={`rounded-xl border p-3 ${assignment.client_requested?'border-red-300 bg-red-50':'bg-slate-50'}`}>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-end">
                          <label className="text-xs font-medium text-slate-600 md:col-span-2">Vai trò<select className="mt-1 w-full rounded border p-2" value={assignment.role} onChange={(e) => updateAssignment(dayIndex, locationIndex, assignmentIndex, "role", e.target.value)}><option>Thợ chụp</option><option>Thợ quay</option><option>Flycam</option><option>Editor</option><option>Livestream</option><option>Makeup</option><option>Lái xe</option></select></label>
                          <label className="text-xs font-medium text-slate-600 md:col-span-4">Nhân sự được phân công<select className="mt-1 w-full rounded border p-2" value={assignment.employee_id} onChange={(e) => { const employee = employees.find((emp: any) => emp.id === e.target.value); updateAssignment(dayIndex, locationIndex, assignmentIndex, "employee_id", e.target.value); if (employee?.base_fee) updateAssignment(dayIndex, locationIndex, assignmentIndex, "salary_amount", Number(employee.base_fee)); }}><option value="">Chọn tên thợ</option>{employees.map((employee: any) => <option key={employee.id} value={employee.id}>{employee.full_name} - {employee.role}</option>)}</select></label>
                          <label className="text-xs font-medium text-slate-600 md:col-span-2">Tiền công thợ<MoneyInput className="mt-1 w-full rounded border p-2" value={assignment.salary_amount} onChange={(v) => updateAssignment(dayIndex, locationIndex, assignmentIndex, "salary_amount", v)} placeholder="700.000" /></label>
                          <label className="text-xs font-medium text-slate-600 md:col-span-3">Ghi chú riêng cho thợ<input className="mt-1 w-full rounded border p-2" value={assignment.note} onChange={(e) => updateAssignment(dayIndex, locationIndex, assignmentIndex, "note", e.target.value)} placeholder="Lưu ý riêng..." /></label>
                          <button onClick={() => removeAssignment(dayIndex, locationIndex, assignmentIndex)} className="rounded-lg border p-2 text-red-600 md:col-span-1">Xóa</button>
                        </div>
                        <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm font-semibold text-red-700"><input type="checkbox" checked={Boolean(assignment.client_requested)} onChange={e=>updateAssignment(dayIndex, locationIndex, assignmentIndex, "client_requested", e.target.checked)} /> ⭐ Khách chỉ định đích danh thợ này</label><label className="mt-2 flex cursor-pointer items-center gap-2 text-sm font-semibold text-blue-700"><input type="checkbox" checked={Boolean(assignment.contact_visible)} onChange={e=>updateAssignment(dayIndex, locationIndex, assignmentIndex, "contact_visible", e.target.checked)} /> 📞 Mở SĐT cho thợ xem ngay</label><p className="mt-1 text-xs text-slate-500">Nếu không bật, hệ thống tự mở SĐT trước giờ làm 48 giờ.</p>
                        {assignment.client_requested&&<p className="mt-1 text-xs text-red-600">Job sẽ được đánh dấu đỏ trên Lịch. Khi thay đổi thợ cần nhập PIN xác nhận.</p>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="border px-5 py-2 rounded-lg">Hủy</button>
          <button onClick={onSave} disabled={saving} className="bg-blue-600 text-white px-5 py-2 rounded-lg disabled:opacity-60">{saving ? "Đang lưu..." : editingJob ? "Cập nhật job" : "Lưu job"}</button>
        </div>
      </div>
    </div>
  );
}

function JobDetail({ job, onClose, onEdit, onDelete }: any) {
  const copyFullJob = async () => {
    const lines:string[]=[`BEEN MEDIA - THÔNG TIN JOB`,`Sự kiện: ${job.event_name||job.customer_name||""}`,`Khách: ${job.customers?.full_name||job.customer_name||""}`,`SĐT khách: ${job.customers?.phone||job.customer_phone||""}`,`SĐT phụ: ${job.customers?.secondary_phone||job.secondary_phone||""}`,`Dịch vụ: ${job.service||""}`,`Ghi chú Job: ${job.note||""}`];
    (job.job_days||[]).forEach((d:any,i:number)=>{lines.push(``,`Ngày ${i+1}: ${formatDateVN(d.shooting_date)||""} • ${d.start_time||"--:--"}-${d.end_time||"--:--"}`,`Địa điểm chung: ${d.location||""}`,`Ghi chú ngày: ${d.note||""}`);(d.job_assignments||[]).forEach((a:any)=>lines.push(`- ${a.role||""}: ${a.employees?.full_name||"Chưa chọn"} | ${a.work_location_name||""} | ${a.work_location_address||""} | SĐT: ${a.work_location_phone||""} | Lương: ${money(a.salary_amount)} | ${a.note||""}`))});
    await navigator.clipboard.writeText(lines.join("\n")); alert("Đã sao chép đầy đủ Job");
  };
  const toggleContact = async (assignment:any) => { const next=!Boolean(assignment.contact_visible); const {error}=await supabase.from("job_assignments").update({contact_visible:next}).eq("id",assignment.id); if(error)return alert(error.message); alert(next?"Đã mở SĐT cho thợ xem ngay":"Đã tắt mở sớm. Hệ thống vẫn tự mở trước 48 giờ."); window.location.reload(); };

  const days = job.job_days || [];
  const [sendingZalo, setSendingZalo] = useState<string | null>(null);

  const sendZaloTemplate = async (type: "confirm" | "review") => {
    const payload = type === "confirm" ? buildZaloConfirmPayload(job) : buildZaloReviewPayload(job);

    if (!payload.phone) {
      alert("Job này chưa có SĐT khách để gửi Zalo OA");
      return;
    }

    setSendingZalo(type);

    try {
      const response = await fetch("/api/zalo/send-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          phone: payload.phone,
          templateData: payload.template_data,
          trackingId: `${job.job_code || job.id}-${type}-${Date.now()}`,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || result.error || "Không gửi được Zalo OA");
      }

      if (type === "confirm") {
        await supabase.from("jobs").update({ status: "Đã xác nhận" }).eq("id", job.id);
      }

      alert(type === "confirm" ? "Đã gửi OA xác nhận lịch" : "Đã gửi OA đánh giá");
    } catch (error: any) {
      alert(error.message || "Không gửi được Zalo OA");
    } finally {
      setSendingZalo(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-6xl p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-5">
          <div>
            <h2 className="text-2xl font-bold">{job.event_name || job.job_code}</h2>
            <p className="text-gray-500">{job.job_code} • {job.customers?.full_name} • {job.service} • {job.status}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-red-600">✕</button>
        </div>

        <div className="grid grid-cols-4 gap-3 mb-5">
          <div className="border rounded-xl p-4"><p className="text-gray-500">Tổng tiền</p><p className="text-xl font-bold">{money(job.total_price)}</p></div>
          <div className="border rounded-xl p-4"><p className="text-gray-500">Đặt cọc</p><p className="text-xl font-bold text-green-700">{money(job.deposit)}</p></div>
          <div className="border rounded-xl p-4"><p className="text-gray-500">Còn nợ</p><p className="text-xl font-bold text-red-600">{money(job.debt)}</p></div>
          <div className="border rounded-xl p-4"><p className="text-gray-500">Số ngày</p><p className="text-xl font-bold">{days.length}</p></div>
        </div>

        <div className="space-y-4">
          {days.map((day: any, index: number) => (
            <div key={day.id} className="border rounded-xl p-4">
              <h3 className="font-bold mb-2">Ngày {index + 1}: {formatDateVN(day.shooting_date)} • {day.start_time} - {day.end_time}</h3>
              <p className="text-gray-600 mb-3">Địa điểm: {day.location}</p>
              <table className="w-full">
                <thead className="bg-slate-50"><tr><th className="text-left p-2">Địa điểm</th><th className="text-left p-2">Địa chỉ / SĐT</th><th className="text-left p-2">Vai trò</th><th className="text-left p-2">Thợ</th><th className="text-left p-2">Lương</th><th className="text-left p-2">SĐT cho thợ</th><th className="text-left p-2">Ghi chú</th></tr></thead>
                <tbody>
                  {(day.job_assignments || []).map((assignment: any) => (
                    <tr key={assignment.id} className="border-t">
                      <td className="p-2 font-semibold">{assignment.work_location_name}</td>
                      <td className="p-2"><div>{assignment.work_location_address}</div><div className="text-xs text-gray-500">{assignment.work_location_phone}</div></td>
                      <td className="p-2">{assignment.role}</td>
                      <td className="p-2">{assignment.employees?.full_name || "Chưa chọn"}</td>
                      <td className="p-2">{money(assignment.salary_amount)}</td>
                      <td className="p-2"><button onClick={()=>toggleContact(assignment)} className={`rounded-lg px-2 py-1 text-xs font-semibold ${assignment.contact_visible?"bg-emerald-100 text-emerald-700":"bg-slate-100 text-slate-700"}`}>{assignment.contact_visible?"Đang mở":"Mở sớm"}</button></td>
                      <td className="p-2">{assignment.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap justify-end gap-3 mt-6">
          <button
            onClick={() => sendZaloTemplate("confirm")}
            disabled={sendingZalo === "confirm"}
            className="bg-green-600 text-white px-4 py-2 rounded-lg disabled:opacity-60"
          >
            {sendingZalo === "confirm" ? "Đang gửi..." : "Gửi OA xác nhận"}
          </button>

          <button
            onClick={() => sendZaloTemplate("review")}
            disabled={sendingZalo === "review"}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg disabled:opacity-60"
          >
            {sendingZalo === "review" ? "Đang gửi..." : "Gửi OA đánh giá"}
          </button>

          <button onClick={copyFullJob} className="bg-blue-600 text-white px-4 py-2 rounded-lg">Sao chép đầy đủ Job</button>
          <button onClick={onClose} className="border px-4 py-2 rounded-lg">Đóng</button>
          <button onClick={onEdit} className="bg-yellow-500 text-white px-4 py-2 rounded-lg">Sửa job</button>
          <button onClick={onDelete} className="bg-red-600 text-white px-4 py-2 rounded-lg">Xóa job</button>
        </div>
      </div>
    </div>
  );
}
