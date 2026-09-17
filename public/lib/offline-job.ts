import { supabase } from "@/lib/supabase";
import { addOfflineItem, deleteOfflineItem, getOfflineItems, patchOfflineItem } from "@/lib/offline-db";

export type OfflineJobBundle = {
  mutationId: string;
  queuedAt: string;
  editingJobId?: string | null;
  baseUpdatedAt?: string | null;
  existingCustomer: boolean;
  customerForm: any;
  jobForm: any;
  days: any[];
  ids: {
    customerId: string;
    jobId: string;
    dayIds: string[];
    locationIds: string[][];
    assignmentIds: string[][][];
    paymentId: string;
  };
};

const uuid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;

export function makeOfflineJobBundle(customerForm: any, jobForm: any, days: any[], editingJob?: any): OfflineJobBundle {
  const customerId = customerForm.customer_id || uuid();
  const jobId = editingJob?.id || uuid();
  return {
    mutationId: uuid(),
    queuedAt: new Date().toISOString(),
    editingJobId: editingJob?.id || null,
    baseUpdatedAt: editingJob?.updated_at || null,
    existingCustomer: Boolean(customerForm.customer_id),
    customerForm: { ...customerForm, customer_id: customerId },
    jobForm: { ...jobForm },
    days: JSON.parse(JSON.stringify(days)),
    ids: {
      customerId,
      jobId,
      dayIds: days.map(() => uuid()),
      locationIds: days.map((d: any) => (d.locations || []).map(() => uuid())),
      assignmentIds: days.map((d: any) => (d.locations || []).map((l: any) => (l.assignments || []).map(() => uuid()))),
      paymentId: uuid(),
    },
  };
}

export async function queueOfflineJob(bundle: OfflineJobBundle) {
  return addOfflineItem("job_bundle", bundle, bundle.mutationId);
}

function normalizeError(error: any) {
  return String(error?.message || error?.details || error || "Lỗi đồng bộ không xác định");
}

async function ensureNoConflict(bundle: OfflineJobBundle) {
  if (!bundle.editingJobId || !bundle.baseUpdatedAt) return;
  const { data, error } = await supabase.from("jobs").select("id,updated_at").eq("id", bundle.editingJobId).maybeSingle();
  if (error) throw error;
  if (data?.updated_at && data.updated_at !== bundle.baseUpdatedAt) {
    const err: any = new Error("Job đã được người khác thay đổi sau khi bản offline được tạo. Cần kiểm tra trước khi ghi đè.");
    err.code = "OFFLINE_CONFLICT";
    throw err;
  }
}

export async function syncOfflineJob(bundle: OfflineJobBundle) {
  await ensureNoConflict(bundle);
  const total = Number(bundle.jobForm.total_price || 0);
  const deposit = Number(bundle.jobForm.deposit || 0);
  const debt = total - deposit;
  const customerId = bundle.ids.customerId;
  const jobId = bundle.ids.jobId;
  const now = new Date().toISOString();

  const customerPayload = {
    id: customerId,
    customer_code: `KH-${bundle.mutationId.slice(0, 8)}`,
    full_name: bundle.customerForm.full_name,
    phone: bundle.customerForm.phone,
    secondary_phone: bundle.customerForm.secondary_phone,
    email: bundle.customerForm.email,
    address: bundle.customerForm.address,
    facebook: bundle.customerForm.facebook,
    service: bundle.jobForm.service,
    total_price: total,
    deposit,
    debt,
    status: bundle.jobForm.status,
    note: bundle.jobForm.note,
    updated_at: now,
  };

  if (bundle.existingCustomer) {
    const {id: _id, customer_code: _code, ...existingUpdate}=customerPayload;
    const { error } = await supabase.from("customers").update(existingUpdate).eq("id", customerId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("customers").upsert(customerPayload, { onConflict: "id" });
    if (error) throw error;
  }

  const jobPayload = {
    id: jobId,
    job_code: bundle.editingJobId ? undefined : `JOB-${bundle.mutationId.slice(0, 8)}`,
    customer_id: customerId,
    customer_name: bundle.customerForm.full_name,
    customer_phone: bundle.customerForm.phone,
    secondary_phone: bundle.customerForm.secondary_phone,
    event_name: bundle.jobForm.event_name,
    booking_date: bundle.jobForm.booking_date || null,
    service: bundle.jobForm.service,
    total_price: total,
    deposit,
    debt,
    status: bundle.jobForm.status,
    location: bundle.jobForm.location,
    required_photo_count: Number(bundle.jobForm.required_photo_count || 0),
    required_video_count: Number(bundle.jobForm.required_video_count || 0),
    note: bundle.jobForm.note,
    updated_at: now,
  };
  Object.keys(jobPayload).forEach((k) => (jobPayload as any)[k] === undefined && delete (jobPayload as any)[k]);

  if (bundle.editingJobId) {
    const { error } = await supabase.from("jobs").update(jobPayload).eq("id", jobId);
    if (error) throw error;
    const { error: deleteDaysError } = await supabase.from("job_days").delete().eq("job_id", jobId);
    if (deleteDaysError) throw deleteDaysError;
  } else {
    const { error } = await supabase.from("jobs").upsert(jobPayload, { onConflict: "id" });
    if (error) throw error;
  }

  if (!bundle.editingJobId && deposit > 0) {
    const { error } = await supabase.from("customer_payments").upsert({
      id: bundle.ids.paymentId,
      customer_id: customerId,
      job_id: jobId,
      amount: deposit,
      payment_date: new Date().toISOString().slice(0, 10),
      method: "Đặt cọc",
      note: "Tự tạo từ Job offline",
    }, { onConflict: "id" });
    if (error) throw error;
  }

  for (let di = 0; di < bundle.days.length; di++) {
    const day = bundle.days[di];
    const dayId = bundle.ids.dayIds[di];
    const locationSummary = (day.locations || []).map((loc: any) => `${loc.location_name}: ${loc.address}`).join(" | ");
    const { error: dayError } = await supabase.from("job_days").upsert({
      id: dayId,
      job_id: jobId,
      shooting_date: day.shooting_date,
      start_time: day.start_time || null,
      end_time: day.end_time || null,
      location: locationSummary || bundle.jobForm.location,
      note: day.note,
    }, { onConflict: "id" });
    if (dayError) throw dayError;

    const locations = day.locations || [];
    if (locations.length) {
      const locationRows = locations.map((location: any, li: number) => ({
        id: bundle.ids.locationIds[di][li],
        job_day_id: dayId,
        location_name: location.location_name,
        address: location.address,
        phone: location.phone,
        sort_order: li,
      }));
      const { error } = await supabase.from("job_locations").upsert(locationRows, { onConflict: "id" });
      if (error) throw error;
    }

    const assignmentRows: any[] = [];
    locations.forEach((location: any, li: number) => {
      (location.assignments || []).forEach((assignment: any, ai: number) => {
        if (!assignment.employee_id) return;
        assignmentRows.push({
          id: bundle.ids.assignmentIds[di][li][ai],
          job_id: jobId,
          job_day_id: dayId,
          employee_id: assignment.employee_id,
          role: assignment.role,
          salary_amount: Number(assignment.salary_amount || 0),
          note: assignment.note,
          client_requested: Boolean(assignment.client_requested),
          contact_visible: Boolean(assignment.contact_visible),
          work_location_name: location.location_name,
          work_location_address: location.address,
          work_location_phone: location.phone,
        });
      });
    });
    if (assignmentRows.length) {
      const { error } = await supabase.from("job_assignments").upsert(assignmentRows, { onConflict: "id" });
      if (error) throw error;
    }
  }
}


export async function queueOfflineCustomer(payload:any){
  const id=payload?.id || (globalThis.crypto?.randomUUID?.() || `customer-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  return addOfflineItem("customer_upsert",{...payload,id,queuedAt:new Date().toISOString()});
}

async function syncOfflineCustomer(payload:any){
  const row={...payload}; delete row.queuedAt; delete row.baseUpdatedAt;
  if(payload.baseUpdatedAt){
    const {data,error}=await supabase.from("customers").select("id,updated_at").eq("id",payload.id).maybeSingle();
    if(error)throw error;
    if(data?.updated_at && data.updated_at!==payload.baseUpdatedAt){const err:any=new Error("Khách hàng đã được người khác sửa sau khi bản offline được tạo.");err.code="OFFLINE_CONFLICT";throw err;}
  }
  row.updated_at=new Date().toISOString();
  const {error}=await supabase.from("customers").upsert(row,{onConflict:"id"});
  if(error)throw error;
}
export async function syncAllOfflineJobs() {
  if (typeof navigator !== "undefined" && !navigator.onLine) return { synced: 0, failed: 0, conflicts: 0 };
  const items = await getOfflineItems();
  let synced = 0, failed = 0, conflicts = 0;
  for (const item of items) {
    if (item.status === "conflict") continue;
    await patchOfflineItem(item.id, { status: "syncing", attempts: item.attempts + 1, lastError: "" });
    try {
      if(item.type === "job_bundle") await syncOfflineJob(item.payload as OfflineJobBundle);
      else if(item.type === "customer_upsert") await syncOfflineCustomer(item.payload);
      else continue;
      await deleteOfflineItem(item.id);
      synced++;
    } catch (error: any) {
      const conflict = error?.code === "OFFLINE_CONFLICT";
      await patchOfflineItem(item.id, { status: conflict ? "conflict" : "error", lastError: normalizeError(error) });
      if (conflict) conflicts++; else failed++;
      if (!navigator.onLine) break;
    }
  }
  if (typeof window !== "undefined" && synced > 0) window.dispatchEvent(new CustomEvent("been:offline-sync-complete", { detail: { synced } }));
  return { synced, failed, conflicts };
}
