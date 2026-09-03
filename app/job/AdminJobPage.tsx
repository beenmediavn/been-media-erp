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


type QuickJobDay={label:string;shooting_date:string;start_time:string;end_time?:string};
type QuickJobPreview={
  main_phone?:string;
  groom_name?:string;
  bride_name?:string;
  groom_phone?:string;
  bride_phone?:string;
  groom_address?:string;
  bride_address?:string;
  package_price?:number;
  photo_count?:number;
  video_count?:number;
  designated_worker?:string;
  days:QuickJobDay[];
  note?:string;
};
const qPhone=(s:string)=>s.replace(/\D/g,"");
const qPad=(n:number)=>String(n).padStart(2,"0");
const timeToMinutes=(value:any)=>{const m=String(value||"00:00").match(/^(\d{1,2}):(\d{2})/);return m?Number(m[1])*60+Number(m[2]):0};
const timeOverlaps=(aStart:any,aEnd:any,bStart:any,bEnd:any)=>timeToMinutes(aStart)<timeToMinutes(bEnd)&&timeToMinutes(aEnd)>timeToMinutes(bStart);
const roleKind=(role:any)=>{const r=String(role||"").toLowerCase();if(r.includes("chụp"))return "photo";if(r.includes("quay")&&!r.includes("fly"))return "video";return "other"};

function qSection(raw:string,n:number){
  const text=raw.replace(/\r/g,"");
  const re=new RegExp(`(?:^|\\n)\\s*${n}\\s*[\\.:\\)]?\\s*([\\s\\S]*?)(?=\\n\\s*[1-8]\\s*[\\.:\\)]?\\s|$)`,`i`);
  return (text.match(re)?.[1]||"").trim();
}
function qFirstPhone(text:string){
  const vals=[...text.matchAll(/(?:\+?84|0)[\d.\s-]{8,14}\d/g)].map(x=>qPhone(x[0])).filter(x=>x.length>=9&&x.length<=11);
  return vals[0]||"";
}
function qTimeFromText(text:string){
  const all=[...text.matchAll(/\b(\d{1,2})(?:\s*h|:)(\d{1,2})?\s*(sáng|chiều|tối)?/gi)];
  const cv=(m:RegExpMatchArray)=>{
    let h=Number(m[1]),min=Number(m[2]||0); const part=(m[3]||"").toLowerCase();
    if((part==="chiều"||part==="tối")&&h<12)h+=12;
    if(part==="sáng"&&h===12)h=0;
    return `${qPad(Math.min(23,h))}:${qPad(Math.min(59,min))}`;
  };
  return {start:all[0]?cv(all[0]):"",end:all[1]?cv(all[1]):""};
}
function qDateFromText(text:string,baseMonth:string){
  const afterDay=text.match(/(?:ngày\s*)?([0-3]?\d)[\/-]([01]?\d)(?:[\/-](20\d{2}|\d{2}))?/i);
  if(!afterDay)return "";
  let y=afterDay[3]?Number(afterDay[3]):Number(baseMonth.slice(0,4)); if(y<100)y+=2000;
  return `${y}-${qPad(Number(afterDay[2]))}-${qPad(Number(afterDay[1]))}`;
}
function qAddress(section:string,kind:"groom"|"bride"){
  const phone=qFirstPhone(section);
  let value=section
    .replace(kind==="groom"?/^(?:địa\s*chỉ\s*)?(?:nhà\s*trai|nhà\s*chú\s*rể|địa\s*điểm\s*chính)\s*(?:\/\s*địa\s*điểm\s*chính)?\s*[:\-]?\s*/i:/^(?:địa\s*chỉ\s*)?(?:nhà\s*gái|nhà\s*cô\s*dâu|địa\s*điểm\s*thứ\s*2)\s*(?:\/\s*địa\s*điểm\s*thứ\s*2)?\s*[:\-]?\s*/i,"")
    .split(/\n+/)
    .filter(line=>!/(?:sđt|số\s*điện\s*thoại|điện\s*thoại)\s*(?:liên\s*hệ)?\s*:/i.test(line))
    .join(", ")
    .replace(/(?:sđt|số\s*điện\s*thoại|điện\s*thoại)\s*(?:liên\s*hệ)?\s*:\s*(?:\+?84|0)[\d.\s-]{8,14}\d/ig,"")
    .replace(/\s+,/g,",").replace(/,\s*,/g,",").replace(/\s{2,}/g," ").trim().replace(/^[:\-\s]+|[,\s]+$/g,"");
  return {address:value,phone};
}
function parseQuickJob(raw:string,baseMonth:string):QuickJobPreview{
  const original=raw.trim();
  const s1=qSection(original,1),s2=qSection(original,2),s3=qSection(original,3),s4=qSection(original,4),s5=qSection(original,5),s6=qSection(original,6),s7=qSection(original,7),s8=qSection(original,8);
  const out:QuickJobPreview={days:[],note:original};
  out.main_phone=qFirstPhone(s1||original);

  if(s2){
    let names=s2.replace(/^.*?(?:chú\s*rể|chu\s*re)\s*[:\-]?\s*/i,"").trim();
    const parts=names.split(/\s+(?:và|va|&)\s+|\s*\+\s*/i).map(v=>v.trim()).filter(Boolean);
    if(parts.length>=2){out.bride_name=parts[0];out.groom_name=parts[1];}
  }

  const groom=qAddress(s4,"groom"),bride=qAddress(s5,"bride");
  out.groom_address=groom.address; out.groom_phone=groom.phone;
  out.bride_address=bride.address; out.bride_phone=bride.phone;
  if(!out.groom_phone&&out.main_phone)out.groom_phone=out.main_phone;
  if(!out.bride_phone&&out.main_phone)out.bride_phone=out.main_phone;

  const dateLines=(s3||original).split(/\n+/).map(v=>v.trim()).filter(Boolean);
  for(const line of dateLines){
    const date=qDateFromText(line,baseMonth); if(!date)continue;
    const times=qTimeFromText(line);
    let label=(line.split(":")[0]||"").trim();
    label=label.replace(/^[-–•\s]+/,"");
    if(!label||/^ngày/i.test(label))label="Ngày chụp";
    out.days.push({label,shooting_date:date,start_time:times.start,end_time:times.end});
  }
  if(!out.days.length){
    const date=qDateFromText(original,baseMonth); const times=qTimeFromText(original);
    if(date)out.days=[{label:/ăn\s*hỏi/i.test(original)?"Lễ ăn hỏi":/cưới/i.test(original)?"Lễ cưới":"Ngày chụp",shooting_date:date,start_time:times.start,end_time:times.end}];
  }
  // Không lấy ngày âm lịch trong ngoặc làm ngày Job: chỉ các ngày đầu dòng/đi sau nội dung sự kiện mới được đưa vào days.
  out.days=out.days.filter((d,i,a)=>a.findIndex(x=>x.shooting_date===d.shooting_date&&x.label.toLowerCase()===d.label.toLowerCase())===i);

  const priceDigits=(s6.match(/[\d][\d.,\s]*/)?.[0]||"").replace(/\D/g,"");
  if(priceDigits)out.package_price=Number(priceDigits);
  const pm=s7.match(/chụp\s*[:\-]?\s*(\d+)/i),vm=s7.match(/quay\s*[:\-]?\s*(\d+)/i);
  if(pm)out.photo_count=Number(pm[1]); if(vm)out.video_count=Number(vm[1]);
  if(s8)out.designated_worker=s8.replace(/^.*?thợ\s*đích\s*danh(?:\s*\([^)]*\))?\s*[:\-]?\s*/i,"").trim()||s8.trim();

  // Fallback cho tin nhắn ngắn không theo mẫu 1-8.
  if(!out.bride_name&&!out.groom_name){
    const nm=original.match(/(?:cô\s*dâu|cd)\s*[:\-]?\s*([^\n,+&]+).*?(?:chú\s*rể|cr)\s*[:\-]?\s*([^\n,+&]+)/i);
    if(nm){out.bride_name=nm[1].trim();out.groom_name=nm[2].trim();}
  }
  return out;
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

  const refreshOfflineCount = async () => {
    try {
      const indexed = await getOfflineCount();
      let legacy = 0;
      try { legacy = JSON.parse(localStorage.getItem("been_offline_job_drafts") || "[]").length; } catch {}
      setOfflineDraftCount(indexed + legacy);
    } catch { setOfflineDraftCount(0); }
  };

  const swapBrideGroomPhones=()=>{
    const groom=customerForm.phone||"";
    const bride=customerForm.secondary_phone||"";
    setCustomerForm((prev:any)=>({...prev,phone:bride,secondary_phone:groom}));
    setDays((prev:any[])=>prev.map((day:any)=>({
      ...day,
      locations:(day.locations||[]).map((loc:any)=>{
        const n=String(loc.location_name||"").toLowerCase();
        if(n.includes("nhà trai")||n.includes("chú rể"))return {...loc,phone:bride};
        if(n.includes("nhà gái")||n.includes("cô dâu"))return {...loc,phone:groom};
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
        .order("created_at", { ascending: false }),
      supabase.from("customers").select("*").order("created_at", { ascending: false }),
      supabase.from("employees").select("*").eq("active", true).order("full_name", { ascending: true }),
      supabase.from("reserve_workers").select("*, employees(*)").eq("status","reserved").order("reserve_date", { ascending: true }),
    ]);
    setLoading(false);

    if (jobError) {
      try {
        const cached=await getOfflineCache<any>("admin-job-data");
        if(cached?.data){setJobs(cached.data.jobs||[]);setCustomers(cached.data.customers||[]);setEmployees(cached.data.employees||[]);setReserveWorkers(cached.data.reserveWorkers||[]);return;}
      } catch {}
      if(typeof navigator==="undefined"||navigator.onLine) alert(jobError.message);
      return;
    }

    setJobs(jobData || []);
    setCustomers(customerData || []);
    setEmployees(empData || []);
    setReserveWorkers(reserveData || []);
    setOfflineCache("admin-job-data",{jobs:jobData||[],customers:customerData||[],employees:empData||[],reserveWorkers:reserveData||[]}).catch(()=>{});
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


  useEffect(() => {
    setDays((prev:any[]) => prev.map((day:any) => ({
      ...day,
      locations:(day.locations||[]).map((loc:any) => {
        const n=String(loc.location_name||"").toLowerCase();
        if(n.includes("nhà trai") || n.includes("chú rể")) return {...loc, phone:customerForm.phone || loc.phone};
        if(n.includes("nhà gái") || n.includes("cô dâu")) return {...loc, phone:customerForm.secondary_phone || loc.phone};
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
      const savedLocations=(day.job_locations||[]).slice().sort((a:any,b:any)=>Number(a.sort_order||0)-Number(b.sort_order||0));
      const locations=savedLocations.map((loc:any)=>({
        location_name:loc.location_name||"Địa điểm",
        address:loc.address||"",
        phone:loc.phone||"",
        note:"",
        assignments:(day.job_assignments||[]).filter((a:any)=>
          String(a.work_location_name||"")===String(loc.location_name||"") &&
          String(a.work_location_address||"")===String(loc.address||"")
        ).map((assignment:any)=>({
          employee_id:assignment.employee_id||"",
          role:assignment.role||"Thợ chụp",
          salary_amount:Number(assignment.salary_amount||0),
          note:assignment.note||"",
          client_requested:Boolean(assignment.client_requested),
          contact_visible:Boolean(assignment.contact_visible),
        }))
      }));
      if(!locations.length){
        const groups:any={};
        (day.job_assignments||[]).forEach((assignment:any)=>{
          const key=[assignment.work_location_name||day.location||"Địa điểm",assignment.work_location_address||"",assignment.work_location_phone||""].join("__");
          if(!groups[key])groups[key]={location_name:assignment.work_location_name||day.location||"Địa điểm",address:assignment.work_location_address||"",phone:assignment.work_location_phone||"",note:"",assignments:[]};
          groups[key].assignments.push({employee_id:assignment.employee_id||"",role:assignment.role||"Thợ chụp",salary_amount:Number(assignment.salary_amount||0),note:assignment.note||"",client_requested:Boolean(assignment.client_requested),contact_visible:Boolean(assignment.contact_visible)});
        });
        locations.push(...Object.values(groups));
      }
      return {shooting_date:day.shooting_date||"",start_time:day.start_time||"07:00",end_time:day.end_time||"11:00",note:day.note||"",locations:locations.length?locations:[makeLocation("Nhà trai"),makeLocation("Nhà gái")]};
    });
  };

  const openEdit = async (job: any, options?: { skipPin?: boolean; focusStaff?: boolean }) => {
    if (!options?.skipPin && !(await requestPin("sửa Job"))) return;
    if (options?.focusStaff && typeof window !== "undefined") sessionStorage.setItem("been-focus-staff","1");
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

  useEffect(()=>{
    if(!jobs.length || typeof window === "undefined") return;
    const params=new URLSearchParams(window.location.search);
    const id=params.get("open");
    if(!id) return;
    const found=jobs.find((j:any)=>String(j.id)===String(id));
    if(!found) return;

    // Chỉ mở form sửa khi URL nói rõ edit=1.
    // Bấm menu Job (/job) luôn chỉ mở danh sách, không đọc trạng thái cũ trong sessionStorage.
    if(params.get("edit")==="1"){
      openEdit(found,{skipPin:true,focusStaff:params.get("focus")==="staff"});
    }else{
      setSelectedJob(found);
    }
    window.history.replaceState({},"",window.location.pathname);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[jobs]);

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

  const getEmployeeConflict=(employeeId:string,dayIndex:number,locationIndex:number,assignmentIndex:number)=>{
    if(!employeeId)return null;
    const currentDay=days[dayIndex];
    if(!currentDay?.shooting_date)return null;
    for(const job of jobs){
      if(editingJob?.id && job.id===editingJob.id)continue;
      for(const jd of (job.job_days||[])){
        if(jd.shooting_date!==currentDay.shooting_date)continue;
        if(!timeOverlaps(currentDay.start_time,currentDay.end_time,jd.start_time,jd.end_time))continue;
        const hit=(jd.job_assignments||[]).find((a:any)=>a.employee_id===employeeId);
        if(hit)return {job:job.event_name||job.customer_name||"Job khác",start:jd.start_time,end:jd.end_time};
      }
    }
    for(let di=0;di<days.length;di++){
      const d=days[di]; if(d.shooting_date!==currentDay.shooting_date||!timeOverlaps(currentDay.start_time,currentDay.end_time,d.start_time,d.end_time))continue;
      for(let li=0;li<(d.locations||[]).length;li++)for(let ai=0;ai<(d.locations[li].assignments||[]).length;ai++){
        if(di===dayIndex&&li===locationIndex&&ai===assignmentIndex)continue;
        if(d.locations[li].assignments[ai].employee_id===employeeId)return {job:"Phân công khác trong Job đang nhập",start:d.start_time,end:d.end_time};
      }
    }
    return null;
  };

  const addReservedWorker = (dayIndex: number, locationIndex: number, reserve: any) => {
    const emp = employees.find((x:any)=>x.id===reserve.employee_id) || reserve.employees;
    setDays((prev) => prev.map((day, i) => {
      if (i !== dayIndex) return day;
      return {...day, locations: day.locations.map((loc:any,j:number)=>{
        if(j!==locationIndex) return loc;
        const alreadyAdded=(loc.assignments||[]).some((a:any)=>String(a.employee_id)===String(reserve.employee_id));
        if(alreadyAdded){
          setTimeout(()=>alert(`${emp?.full_name||"Thợ"} đã có trong phân công của địa điểm này.`),0);
          return loc;
        }
        return {...loc, assignments:[...loc.assignments, {employee_id: reserve.employee_id, role: reserve.role || emp?.role || "Thợ chụp", salary_amount: Number(emp?.base_fee || (String(reserve.role).includes("quay") ? 900000 : 700000)), note: "Thêm từ thợ dự phòng", reserve_worker_id: reserve.id, client_requested: false, contact_visible: false}]};
      })};
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

  const saveOfflineDraft = async () => {
    try {
      const bundle = makeOfflineJobBundle(customerForm, jobForm, days, editingJob);
      await queueOfflineJob(bundle);
      await refreshOfflineCount();
      setOpenForm(false);
      alert("Đã lưu OFFLINE trên thiết bị. Khi có mạng, app sẽ tự đồng bộ lên hệ thống. Bạn có thể xem số mục chờ đồng bộ ở biểu tượng mạng.");
    } catch (error:any) {
      alert(error?.message || "Không lưu được dữ liệu offline trên thiết bị");
    }
  };

  // Giữ khả năng mở các bản nháp localStorage từ phiên bản cũ để không làm mất dữ liệu đã nhập trước đây.
  const restoreOfflineDraft = () => {
    try {
      const list = JSON.parse(localStorage.getItem("been_offline_job_drafts") || "[]");
      const item = list.pop();
      if (!item) return alert("Không còn bản nháp offline kiểu cũ. Các bản mới sẽ tự đồng bộ khi có mạng.");
      localStorage.setItem("been_offline_job_drafts", JSON.stringify(list));
      setEditingJob(null); setCustomerForm(item.customerForm); setJobForm(item.jobForm); setDays(item.days); setOpenForm(true); refreshOfflineCount();
    } catch { alert("Không đọc được bản nháp offline"); }
  };

  async function markUsedReserveWorkers(jobId:string){
    const ids:string[]=Array.from(new Set<string>(days.flatMap((day:any)=>day.locations?.flatMap((loc:any)=>loc.assignments?.map((a:any)=>a.reserve_worker_id).filter(Boolean)||[])||[]) as string[]));
    if(!ids.length)return;
    const {error}=await supabase.from("reserve_workers").update({status:"used",assigned_job_id:jobId,assigned_at:new Date().toISOString()}).in("id",ids);
    if(error)throw error;
    setReserveWorkers((prev:any[])=>prev.filter((r:any)=>!ids.includes(r.id)));
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
    for(let di=0;di<days.length;di++){
      for(let li=0;li<(days[di].locations||[]).length;li++){
        for(let ai=0;ai<(days[di].locations[li].assignments||[]).length;ai++){
          const a=days[di].locations[li].assignments[ai];
          if(!a.employee_id)continue;
          const conflict=getEmployeeConflict(a.employee_id,di,li,ai);
          if(conflict){const emp=employees.find((e:any)=>e.id===a.employee_id);alert(`${emp?.full_name||"Nhân sự"} đã có lịch trùng giờ ${conflict.start}-${conflict.end} (${conflict.job}). Hãy chọn thợ khác hoặc đổi khung giờ.`);return;}
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

          if (day.locations?.length) {
            const { error: locationError } = await supabase.from("job_locations").insert(
              day.locations.map((location:any,sortIndex:number)=>({job_day_id:createdDay.id,location_name:location.location_name,address:location.address,phone:location.phone,sort_order:sortIndex}))
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
            const { error: assignmentError } = await supabase
              .from("job_assignments")
              .insert(assignmentRows);
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

        if (day.locations?.length) {
          const { error: locationError } = await supabase.from("job_locations").insert(
            day.locations.map((location:any,sortIndex:number)=>({job_day_id:createdDay.id,location_name:location.location_name,address:location.address,phone:location.phone,sort_order:sortIndex}))
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
        <div className="flex flex-wrap gap-2"><button onClick={()=>{setQuickText("");setQuickPreview(null);setShowQuickJob(true)}} className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-3 font-semibold text-blue-700">✦ Nhập Job nhanh</button><button onClick={openCreate} className="bg-blue-600 text-white px-5 py-3 rounded-xl">+ Tạo job mới</button>{offlineDraftCount>0&&<button onClick={()=>{const legacy=JSON.parse(localStorage.getItem("been_offline_job_drafts")||"[]");if(legacy.length)restoreOfflineDraft();else alert(`${offlineDraftCount} thay đổi đang chờ tự đồng bộ. Bấm biểu tượng mạng ở góc màn hình để xem trạng thái.`)}} className="rounded-xl bg-amber-500 px-4 py-3 font-semibold text-white">Chờ đồng bộ ({offlineDraftCount})</button>}</div>
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
          swapBrideGroomPhones={swapBrideGroomPhones}
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
          onEdit={() => {
            setSelectedJob(null);
            openEdit(selectedJob);
          }}
          onDelete={() => deleteJob(selectedJob.id)}
        />
      )}
    
{showQuickJob&&<div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
        <div className="max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div><h2 className="text-xl font-black">Nhập Job nhanh</h2><p className="text-sm text-slate-500">Dán nguyên tin nhắn khách. Hệ thống ưu tiên đọc đúng mẫu 1→8 của BEEN MEDIA và hỗ trợ Job 2 ngày.</p></div>
            <button onClick={()=>setShowQuickJob(false)} className="rounded-xl border px-3 py-2">✕</button>
          </div>
          <textarea value={quickText} onChange={e=>setQuickText(e.target.value)} rows={10} className="w-full rounded-2xl border p-4 leading-6" placeholder={'1. Số điện thoại: ...\n2. Tên Cô Dâu + Chú Rể: ...\n3. Ngày tổ chức...\n4. Địa chỉ Nhà Trai...\n5. Địa chỉ Nhà Gái...\n6. Gói Chốt...\n7. Số lượng nhân sự...\n8. Thợ đích danh...'}/>
          <button onClick={()=>setQuickPreview(parseQuickJob(quickText,quickBaseMonth))} disabled={!quickText.trim()} className="mt-3 w-full rounded-xl bg-blue-600 p-3 font-bold text-white disabled:opacity-40">Phân tích thông tin</button>
          {quickPreview&&<div className="mt-4 rounded-2xl bg-slate-50 p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-black">Kiểm tra & sửa trước khi đưa vào Job</h3><p className="text-xs text-slate-500">Tất cả ô dưới đây đều sửa được. Không tự lưu vào hệ thống.</p></div><span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">Nhận {quickPreview.days.length} ngày</span></div>

            <div className="rounded-2xl border bg-white p-4">
              <h4 className="mb-3 font-black text-blue-800">KHÁCH HÀNG</h4>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <label className="text-xs font-bold text-slate-600">Cô dâu<input value={quickPreview.bride_name||""} onChange={e=>setQuickPreview({...quickPreview,bride_name:e.target.value})} className="mt-1 w-full rounded-xl border p-3 text-sm font-medium"/></label>
                <label className="text-xs font-bold text-slate-600">Chú rể<input value={quickPreview.groom_name||""} onChange={e=>setQuickPreview({...quickPreview,groom_name:e.target.value})} className="mt-1 w-full rounded-xl border p-3 text-sm font-medium"/></label>
                <label className="text-xs font-bold text-slate-600">SĐT khách gửi chính<input value={quickPreview.main_phone||""} onChange={e=>setQuickPreview({...quickPreview,main_phone:e.target.value})} className="mt-1 w-full rounded-xl border p-3 text-sm font-medium"/></label>
              </div>
            </div>

            <div className="mt-3 rounded-2xl border bg-white p-4">
              <h4 className="mb-3 font-black text-blue-800">NGÀY TỔ CHỨC</h4>
              <div className="space-y-3">{quickPreview.days.map((d,idx)=><div key={idx} className="grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-[1.2fr_1fr_.8fr_.8fr_auto] sm:items-end">
                <label className="text-xs font-bold text-slate-600">Nội dung<input value={d.label} onChange={e=>setQuickPreview({...quickPreview,days:quickPreview.days.map((x,i)=>i===idx?{...x,label:e.target.value}:x)})} className="mt-1 w-full rounded-lg border bg-white p-2.5 text-sm"/></label>
                <label className="text-xs font-bold text-slate-600">Ngày DL<input type="date" value={d.shooting_date} onChange={e=>setQuickPreview({...quickPreview,days:quickPreview.days.map((x,i)=>i===idx?{...x,shooting_date:e.target.value}:x)})} className="mt-1 w-full rounded-lg border bg-white p-2.5 text-sm"/></label>
                <label className="text-xs font-bold text-slate-600">Bắt đầu<input value={d.start_time||""} onChange={e=>setQuickPreview({...quickPreview,days:quickPreview.days.map((x,i)=>i===idx?{...x,start_time:e.target.value}:x)})} className="mt-1 w-full rounded-lg border bg-white p-2.5 text-sm" placeholder="08:00"/></label>
                <label className="text-xs font-bold text-slate-600">Kết thúc<input value={d.end_time||""} onChange={e=>setQuickPreview({...quickPreview,days:quickPreview.days.map((x,i)=>i===idx?{...x,end_time:e.target.value}:x)})} className="mt-1 w-full rounded-lg border bg-white p-2.5 text-sm" placeholder="Không bắt buộc"/></label>
                <button type="button" onClick={()=>setQuickPreview({...quickPreview,days:quickPreview.days.filter((_,i)=>i!==idx)})} className="rounded-lg border border-red-200 px-3 py-2.5 text-xs font-bold text-red-600">Xóa</button>
              </div>)}</div>
              <button type="button" onClick={()=>setQuickPreview({...quickPreview,days:[...quickPreview.days,{label:`Ngày ${quickPreview.days.length+1}`,shooting_date:"",start_time:"",end_time:""}]})} className="mt-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">+ Thêm ngày</button>
              <p className="mt-2 text-xs text-slate-500">Ngày Âm lịch trong ngoặc chỉ để tham khảo, không được dùng làm ngày Job.</p>
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <div className="rounded-2xl border bg-white p-4"><h4 className="mb-3 font-black text-blue-800">NHÀ TRAI</h4><label className="text-xs font-bold text-slate-600">Địa chỉ<textarea value={quickPreview.groom_address||""} onChange={e=>setQuickPreview({...quickPreview,groom_address:e.target.value})} rows={3} className="mt-1 w-full rounded-xl border p-3 text-sm"/></label><label className="mt-2 block text-xs font-bold text-slate-600">SĐT nhà trai<input value={quickPreview.groom_phone||""} onChange={e=>setQuickPreview({...quickPreview,groom_phone:e.target.value})} className="mt-1 w-full rounded-xl border p-3 text-sm"/></label></div>
              <div className="rounded-2xl border bg-white p-4"><h4 className="mb-3 font-black text-blue-800">NHÀ GÁI</h4><label className="text-xs font-bold text-slate-600">Địa chỉ<textarea value={quickPreview.bride_address||""} onChange={e=>setQuickPreview({...quickPreview,bride_address:e.target.value})} rows={3} className="mt-1 w-full rounded-xl border p-3 text-sm"/></label><label className="mt-2 block text-xs font-bold text-slate-600">SĐT nhà gái<input value={quickPreview.bride_phone||""} onChange={e=>setQuickPreview({...quickPreview,bride_phone:e.target.value})} className="mt-1 w-full rounded-xl border p-3 text-sm"/></label></div>
            </div>

            <div className="mt-3 rounded-2xl border bg-white p-4">
              <h4 className="mb-3 font-black text-blue-800">GÓI & NHÂN SỰ</h4>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="text-xs font-bold text-slate-600">Gói chốt / Tổng tiền<input type="number" value={quickPreview.package_price||0} onChange={e=>setQuickPreview({...quickPreview,package_price:Number(e.target.value||0)})} className="mt-1 w-full rounded-xl border p-3 text-sm"/></label>
                <label className="text-xs font-bold text-slate-600">Photographer<input type="number" min="0" value={quickPreview.photo_count??0} onChange={e=>setQuickPreview({...quickPreview,photo_count:Number(e.target.value||0)})} className="mt-1 w-full rounded-xl border p-3 text-sm"/></label>
                <label className="text-xs font-bold text-slate-600">CAMERAMEN<input type="number" min="0" value={quickPreview.video_count??0} onChange={e=>setQuickPreview({...quickPreview,video_count:Number(e.target.value||0)})} className="mt-1 w-full rounded-xl border p-3 text-sm"/></label>
                <label className="text-xs font-bold text-slate-600">Thợ đích danh<input value={quickPreview.designated_worker||""} onChange={e=>setQuickPreview({...quickPreview,designated_worker:e.target.value})} className="mt-1 w-full rounded-xl border p-3 text-sm"/></label>
              </div>
            </div>

            <button onClick={()=>{
              const q=quickPreview;
              if(!q.days.length){alert("Chưa nhận được ngày tổ chức. Hãy thêm ít nhất 1 ngày trước khi đưa vào form Job.");return;}
              setEditingJob(null);
              const displayName=[q.bride_name,q.groom_name].filter(Boolean).join(" & ");
              setCustomerForm((c:any)=>({...c,full_name:displayName||c.full_name,facebook:displayName||c.facebook,phone:q.groom_phone||q.main_phone||c.phone,secondary_phone:q.bride_phone||q.main_phone||c.secondary_phone,address:q.groom_address||q.bride_address||c.address}));
              setJobForm((j:any)=>({...j,event_name:displayName||j.event_name,total_price:Number(q.package_price||j.total_price||0),required_photo_count:Number(q.photo_count||0),required_video_count:Number(q.video_count||0),location:q.groom_address||q.bride_address||j.location,note:[j.note,q.designated_worker?`Thợ đích danh khách yêu cầu: ${q.designated_worker}`:"",q.main_phone?`SĐT khách gửi chính: ${q.main_phone}`:"",`Tin gốc:\n${quickText}`].filter(Boolean).join("\n")}));
              const normalizedDesignated=String(q.designated_worker||"").trim().toLowerCase();
              const matched=normalizedDesignated?employees.filter((e:any)=>String(e.full_name||"").toLowerCase()===normalizedDesignated):[];
              setDays(q.days.map((qd:any)=>{
                const d=makeDay();
                d.shooting_date=qd.shooting_date||""; d.start_time=qd.start_time||""; d.end_time=qd.end_time||""; d.note=qd.label||"";
                d.locations=[makeLocation("Nhà trai"),makeLocation("Nhà gái")];
                d.locations[0].address=q.groom_address||""; d.locations[0].phone=q.groom_phone||q.main_phone||"";
                d.locations[1].address=q.bride_address||""; d.locations[1].phone=q.bride_phone||q.main_phone||"";
                if(matched.length===1){
                  const emp=matched[0]; const isVideo=/(quay|video|camera)/i.test(String(emp.role||""));
                  const role=isVideo?"Thợ quay":"Thợ chụp";
                  const target=d.locations[0].assignments.find((a:any)=>a.role===role)||d.locations[0].assignments[0];
                  target.employee_id=emp.id; target.client_requested=true; target.note="Khách yêu cầu đích danh từ Nhập Job nhanh";
                }
                return d;
              }));
              setShowQuickJob(false);setOpenForm(true);
            }} className="mt-4 w-full rounded-xl bg-emerald-600 p-3 font-black text-white">ĐƯA VÀO FORM JOB ĐỂ KIỂM TRA</button>
          </div>}
          <p className="mt-3 text-xs text-slate-500">Bản V8.3: ưu tiên mẫu 1→8 • nhận 2 ngày trở lên • tách Nhà trai/Nhà gái/SĐT • gói tiền • số thợ • thợ đích danh • cho sửa tay trước khi đưa vào Job.</p>
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
    swapBrideGroomPhones,
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
    getEmployeeConflict,
    editingJob,
    saving,
    onClose,
    onSave,
  } = props;

  useEffect(()=>{
    if(typeof window === "undefined") return;
    const shouldFocus=sessionStorage.getItem("been-focus-staff")==="1";
    if(!shouldFocus) return;
    sessionStorage.removeItem("been-focus-staff");
    const timer=window.setTimeout(()=>document.getElementById("staffing-section")?.scrollIntoView({behavior:"smooth",block:"start"}),300);
    return ()=>window.clearTimeout(timer);
  },[]);

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
                  facebook: customer?.facebook || customer?.full_name || "",
                });
              }}
            >
              <option value="">Khách mới hoặc chọn khách CRM</option>
              {customers.map((customer: any) => (
                <option key={customer.id} value={customer.id}>{customer.full_name} - {customer.phone}</option>
              ))}
            </select></label>
            <label className="block text-sm font-medium text-slate-700">Tên khách đại diện / người book<input className="mt-1 border p-3 rounded-lg w-full" placeholder="Ví dụ: Nguyễn Văn A" value={customerForm.full_name} onChange={(e) => { const name=e.target.value; setCustomerForm({ ...customerForm, full_name:name, facebook:name }); }} /></label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
              <label className="text-sm font-medium text-slate-700">SĐT chú rể / nhà trai<input className="mt-1 border p-3 rounded-lg w-full" placeholder="058..." value={customerForm.phone} onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })} /></label>
              <button type="button" onClick={swapBrideGroomPhones} className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-3 text-sm font-bold text-blue-700" title="Đổi SĐT hai nhà">⇄ Đổi SĐT</button>
              <label className="text-sm font-medium text-slate-700">SĐT cô dâu / nhà gái<input className="mt-1 border p-3 rounded-lg w-full" placeholder="SĐT phụ" value={customerForm.secondary_phone} onChange={(e) => setCustomerForm({ ...customerForm, secondary_phone: e.target.value })} /></label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input className="border p-3 rounded-lg" placeholder="Email" value={customerForm.email} onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })} />
              <input className="border p-3 rounded-lg" placeholder="Tên hiển thị Facebook/Zalo" value={customerForm.facebook} onChange={(e) => setCustomerForm({ ...customerForm, facebook: e.target.value })} />
            </div>
          </div>

          <div className="border rounded-xl p-4 space-y-3">
            <h3 className="font-bold text-lg">2. Booking / Thanh toán</h3>
            <input className="border p-3 rounded-lg w-full" placeholder="Tên sự kiện / tên dâu rể. Ví dụ: TUẤN BEEN & THU THỦY" value={jobForm.event_name} onChange={(e) => setJobForm({ ...jobForm, event_name: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm text-gray-600">Ngày khách đặt lịch<input type="date" className="border p-3 rounded-lg w-full mt-1" value={jobForm.booking_date} onChange={(e) => setJobForm({ ...jobForm, booking_date: e.target.value })} /></label>
              <label className="text-sm text-gray-600">Trạng thái<select className="border p-3 rounded-lg w-full mt-1" value={jobForm.status} onChange={(e) => setJobForm({ ...jobForm, status: e.target.value })}><option>Chưa chốt</option><option>Đã đặt cọc</option><option>Đang chụp</option><option>Đang hậu kỳ</option><option>Đã bàn giao</option><option>Hoàn thành</option><option>Hủy</option></select></label>
            </div>
            <input className="border p-3 rounded-lg w-full" placeholder="Gói dịch vụ. Ví dụ: Combo VIP - 3 chụp 2 quay" value={jobForm.service} onChange={(e) => setJobForm({ ...jobForm, service: e.target.value })} />
            <div className="grid grid-cols-1 gap-3 rounded-xl border border-blue-100 bg-blue-50 p-3 sm:grid-cols-2">
              <label className="text-sm font-semibold text-blue-900">Tổng thợ CHỤP cần<input type="number" min="0" className="mt-1 w-full rounded-lg border bg-white p-3" value={jobForm.required_photo_count||0} onChange={e=>setJobForm({...jobForm,required_photo_count:Math.max(0,Number(e.target.value||0))})}/></label>
              <label className="text-sm font-semibold text-blue-900">Tổng thợ QUAY cần<input type="number" min="0" className="mt-1 w-full rounded-lg border bg-white p-3" value={jobForm.required_video_count||0} onChange={e=>setJobForm({...jobForm,required_video_count:Math.max(0,Number(e.target.value||0))})}/></label>
              <p className="text-xs text-blue-700 sm:col-span-2">Dùng để cảnh báo Job còn thiếu thợ trên Tổng quát. Ví dụ: cần 3 chụp + 2 quay.</p>
            </div>
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

        <div id="staffing-section" className="mt-6 scroll-mt-6 space-y-4">
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
                <label className="text-sm text-gray-600">Từ giờ<Time24Input className="border p-3 rounded-lg w-full mt-1" value={day.start_time} onChange={(value) => updateDay(dayIndex, "start_time", value)} /></label>
                <label className="text-sm text-gray-600">Đến giờ<Time24Input className="border p-3 rounded-lg w-full mt-1" value={day.end_time} onChange={(value) => updateDay(dayIndex, "end_time", value)} /></label>
                <label className="text-sm text-gray-600">Ghi chú ngày<input className="border p-3 rounded-lg w-full mt-1" value={day.note} onChange={(e) => updateDay(dayIndex, "note", e.target.value)} placeholder="Ăn hỏi / tiệc / lưu ý timeline..." /></label>
              </div>

              <div className="flex justify-between items-center">
                <p className="font-semibold">Các địa điểm trong ngày này</p>
                <button onClick={() => addLocation(dayIndex)} className="bg-blue-600 text-white px-3 py-2 rounded-lg">+ Thêm địa chỉ / nhà gái</button>
              </div>

              {day.shooting_date && reserveWorkers.filter((r:any)=>r.reserve_date===day.shooting_date).length>0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <p className="mb-2 text-sm font-bold text-amber-900">Thợ dự phòng ngày {formatDateVN(day.shooting_date)} — chọn để xếp vào Job</p>
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
                          <label className="text-xs font-medium text-slate-600 md:col-span-4">Nhân sự được phân công<EmployeePicker employees={employees} value={assignment.employee_id} getConflict={(id)=>getEmployeeConflict(id,dayIndex,locationIndex,assignmentIndex)} onChange={(id)=>{const conflict=id?getEmployeeConflict(id,dayIndex,locationIndex,assignmentIndex):null;if(conflict){alert(`Thợ này đã có Job trùng ${conflict.start}-${conflict.end}: ${conflict.job}`);return;}const employee=employees.find((emp:any)=>emp.id===id);updateAssignment(dayIndex,locationIndex,assignmentIndex,"employee_id",id);if(employee?.base_fee)updateAssignment(dayIndex,locationIndex,assignmentIndex,"salary_amount",Number(employee.base_fee));}}/>{assignment.employee_id&&getEmployeeConflict(assignment.employee_id,dayIndex,locationIndex,assignmentIndex)&&<span className="mt-1 block text-[11px] font-semibold text-red-600">⚠ Thợ này đang trùng lịch, cần đổi thợ hoặc đổi giờ.</span>}</label>
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
  const [adjustments,setAdjustments]=useState<any[]>([]);
  const [showAdjustment,setShowAdjustment]=useState(false);
  const [editingAdjustment,setEditingAdjustment]=useState<any>(null);
  const [adjustmentForm,setAdjustmentForm]=useState<any>({
    employee_id:"",
    adjustment_type:"tip",
    amount:0,
    note:"",
    received_by_studio:true,
    adjustment_date:new Date().toISOString().slice(0,10),
  });

  const loadAdjustments=async()=>{
    const {data}=await supabase
      .from("salary_adjustments")
      .select("*, employees(full_name)")
      .eq("job_id",job.id)
      .order("adjustment_date",{ascending:false});
    setAdjustments(data||[]);
  };
  useEffect(()=>{loadAdjustments()},[job.id]);

  const assignedWorkers=Array.from(new Map(
    (job.job_days||[])
      .flatMap((d:any)=>d.job_assignments||[])
      .filter((a:any)=>a.employee_id)
      .map((a:any)=>[a.employee_id,{id:a.employee_id,full_name:a.employees?.full_name||"Nhân sự"}])
  ).values()) as any[];

  const openNewAdjustment=()=>{
    setEditingAdjustment(null);
    setAdjustmentForm({
      employee_id:assignedWorkers[0]?.id||"",
      adjustment_type:"tip",
      amount:0,
      note:"",
      received_by_studio:true,
      adjustment_date:new Date().toISOString().slice(0,10),
    });
    setShowAdjustment(true);
  };

  const saveAdjustment=async()=>{
    if(!adjustmentForm.employee_id) return alert("Vui lòng chọn nhân sự");
    const raw=Math.abs(Number(adjustmentForm.amount||0));
    if(!raw) return alert("Vui lòng nhập số tiền");
    const amount=adjustmentForm.adjustment_type==="penalty"?-raw:raw;
    const payload={
      employee_id:adjustmentForm.employee_id,
      job_id:job.id,
      adjustment_date:adjustmentForm.adjustment_date,
      adjustment_type:adjustmentForm.adjustment_type,
      amount,
      note:adjustmentForm.note||"",
      received_by_studio:Boolean(adjustmentForm.received_by_studio),
    };
    const q=editingAdjustment
      ? supabase.from("salary_adjustments").update(payload).eq("id",editingAdjustment.id)
      : supabase.from("salary_adjustments").insert([payload]);
    const {error}=await q;
    if(error) return alert(error.message);
    setShowAdjustment(false);setEditingAdjustment(null);await loadAdjustments();
  };

  const editAdjustment=(x:any)=>{
    setEditingAdjustment(x);
    setAdjustmentForm({
      employee_id:x.employee_id,
      adjustment_type:x.adjustment_type,
      amount:Math.abs(Number(x.amount||0)),
      note:x.note||"",
      received_by_studio:Boolean(x.received_by_studio),
      adjustment_date:x.adjustment_date,
    });
    setShowAdjustment(true);
  };

  const deleteAdjustment=async(x:any)=>{
    if(!(await requireEditPin("xóa phát sinh lương"))) return;
    if(!confirm(`Xóa phát sinh ${money(x.amount)}?`)) return;
    const {error}=await supabase.from("salary_adjustments").delete().eq("id",x.id);
    if(error) return alert(error.message);
    await loadAdjustments();
  };


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

        <div className="mb-4 rounded-2xl border border-blue-100 bg-blue-50 p-4">
          <h3 className="font-bold text-blue-900">Nhu cầu nhân sự</h3>
          <div className="mt-2 flex flex-wrap gap-3 text-sm"><span className="rounded-full bg-white px-3 py-1 font-semibold">Cần chụp: {Number(job.required_photo_count||0)}</span><span className="rounded-full bg-white px-3 py-1 font-semibold">Cần quay: {Number(job.required_video_count||0)}</span></div>
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


        <div className="mt-5 rounded-2xl border bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h3 className="font-bold text-lg">Phát sinh lương theo Job</h3><p className="text-sm text-slate-500">Tip/bonus cộng vào lương. Vi phạm/khấu trừ sẽ trừ khỏi lương thợ.</p></div>
            <button onClick={openNewAdjustment} className="rounded-xl bg-indigo-600 px-4 py-2 font-semibold text-white">+ Thêm phát sinh</button>
          </div>
          <div className="mt-3 space-y-2">
            {adjustments.map((x:any)=><div key={x.id} className="flex flex-col gap-2 rounded-xl bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">{x.employees?.full_name||"Nhân sự"} • <span className={Number(x.amount)<0?"text-red-600":"text-emerald-700"}>{Number(x.amount)<0?"Trừ ":"Cộng "}{money(Math.abs(Number(x.amount||0)))}</span></p>
                <p className="text-sm text-slate-500">{formatDateVN(x.adjustment_date)} • {x.adjustment_type==="tip"?"Tip khách":x.adjustment_type==="bonus"?"Thưởng":x.adjustment_type==="penalty"?"Vi phạm / khấu trừ":"Khác"}{x.received_by_studio?" • Tiền qua TK studio":""}</p>
                {x.note&&<p className="text-sm">{x.note}</p>}
              </div>
              <div className="flex gap-2"><button onClick={()=>editAdjustment(x)} className="rounded-lg bg-amber-500 px-3 py-2 text-white">Sửa</button><button onClick={()=>deleteAdjustment(x)} className="rounded-lg bg-red-600 px-3 py-2 text-white">Xóa</button></div>
            </div>)}
            {!adjustments.length&&<p className="text-sm text-slate-500">Chưa có phát sinh lương cho Job này.</p>}
          </div>
        </div>

        {showAdjustment&&<div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5">
            <h3 className="text-xl font-bold">{editingAdjustment?"Sửa phát sinh":"Thêm phát sinh lương"}</h3>
            <div className="mt-4 space-y-3">
              <label className="block text-sm font-medium">Nhân sự
                <select className="mt-1 w-full rounded-xl border p-3" value={adjustmentForm.employee_id} onChange={e=>setAdjustmentForm({...adjustmentForm,employee_id:e.target.value})}>
                  <option value="">Chọn nhân sự</option>{assignedWorkers.map((e:any)=><option key={e.id} value={e.id}>{e.full_name}</option>)}
                </select>
              </label>
              <label className="block text-sm font-medium">Loại phát sinh
                <select className="mt-1 w-full rounded-xl border p-3" value={adjustmentForm.adjustment_type} onChange={e=>setAdjustmentForm({...adjustmentForm,adjustment_type:e.target.value})}>
                  <option value="tip">Tip khách → cộng lương</option><option value="bonus">Thưởng → cộng lương</option><option value="penalty">Vi phạm / khấu trừ → trừ lương</option><option value="other">Khác</option>
                </select>
              </label>
              <label className="block text-sm font-medium">Số tiền<MoneyInput className="mt-1 w-full rounded-xl border p-3" value={adjustmentForm.amount||0} onChange={v=>setAdjustmentForm({...adjustmentForm,amount:v})}/></label>
              <label className="block text-sm font-medium">Ngày<input type="date" className="mt-1 w-full rounded-xl border p-3" value={adjustmentForm.adjustment_date} onChange={e=>setAdjustmentForm({...adjustmentForm,adjustment_date:e.target.value})}/></label>
              <label className="block text-sm font-medium">Nội dung / lý do<textarea className="mt-1 w-full rounded-xl border p-3" rows={3} value={adjustmentForm.note} onChange={e=>setAdjustmentForm({...adjustmentForm,note:e.target.value})} placeholder="VD: Khách tip thợ 500k / Đi muộn 30 phút..."/></label>
              {adjustmentForm.adjustment_type==="tip"&&<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(adjustmentForm.received_by_studio)} onChange={e=>setAdjustmentForm({...adjustmentForm,received_by_studio:e.target.checked})}/> Khách chuyển tiền tip vào tài khoản studio</label>}
            </div>
            <div className="mt-5 flex justify-end gap-2"><button onClick={()=>setShowAdjustment(false)} className="rounded-xl border px-4 py-2">Hủy</button><button onClick={saveAdjustment} className="rounded-xl bg-blue-600 px-4 py-2 text-white">Lưu phát sinh</button></div>
          </div>
        </div>}

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
