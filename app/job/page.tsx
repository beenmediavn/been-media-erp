"use client";

import { useEffect, useMemo, useState } from "react";
import MainLayout from "../components/layout/MainLayout";
import { supabase } from "@/lib/supabase";

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


const formatDateVN = (value: string | null | undefined) => {
  if (!value) return "";
  const [year, month, day] = String(value).split("-");
  if (!year || !month || !day) return String(value);
  return `${day}/${month}/${year}`;
};

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

export default function JobPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [openForm, setOpenForm] = useState(false);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [editingJob, setEditingJob] = useState<any>(null);
  const [customerForm, setCustomerForm] = useState<any>(emptyCustomer);
  const [jobForm, setJobForm] = useState<any>(emptyJob);
  const [days, setDays] = useState<any[]>([makeDay()]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadData() {
    setLoading(true);
    const [{ data: jobData, error: jobError }, { data: customerData }, { data: empData }] = await Promise.all([
      supabase
        .from("jobs")
        .select("*, customers(*), job_days(*, job_assignments(*, employees(*)))")
        .order("created_at", { ascending: false }),
      supabase.from("customers").select("*").order("created_at", { ascending: false }),
      supabase.from("employees").select("*").eq("active", true).order("full_name", { ascending: true }),
    ]);
    setLoading(false);

    if (jobError) {
      alert(jobError.message);
      return;
    }

    setJobs(jobData || []);
    setCustomers(customerData || []);
    setEmployees(empData || []);
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

  const openEdit = (job: any) => {
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

    setSaving(true);

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
      setCustomerForm({ ...emptyCustomer });
      setJobForm({ ...emptyJob });
      setDays([makeDay()]);
      await loadData();
    } catch (error: any) {
      alert(error.message || "Không lưu được job");
    } finally {
      setSaving(false);
    }
  }

  async function deleteJob(id: string) {
    if (!confirm("Bạn chắc chắn muốn xóa job này?")) return;
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

  return (
    <MainLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Job / Booking</h1>
          <p className="text-gray-500 mt-1">Tạo job, ngày chụp, địa điểm từng nhà, phân công thợ và tính lương tự động</p>
        </div>
        <button onClick={openCreate} className="bg-blue-600 text-white px-5 py-3 rounded-lg">
          + Tạo job mới
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-5 shadow"><p className="text-gray-500">Tổng job</p><p className="text-3xl font-bold mt-2">{jobs.length}</p></div>
        <div className="bg-white rounded-xl p-5 shadow"><p className="text-gray-500">Doanh thu</p><p className="text-2xl font-bold mt-2">{money(totals.revenue)}</p></div>
        <div className="bg-white rounded-xl p-5 shadow"><p className="text-gray-500">Công nợ khách</p><p className="text-2xl font-bold mt-2 text-red-600">{money(totals.debt)}</p></div>
        <div className="bg-white rounded-xl p-5 shadow"><p className="text-gray-500">Lương thợ</p><p className="text-2xl font-bold mt-2 text-orange-600">{money(totals.salary)}</p></div>
      </div>

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
              <th className="text-left p-3">Trạng thái</th>
              <th className="text-left p-3">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td className="p-4 text-gray-500" colSpan={10}>Đang tải job...</td></tr>}
            {!loading && jobs.length === 0 && <tr><td className="p-4 text-gray-500" colSpan={10}>Chưa có job. Bấm “Tạo job mới”.</td></tr>}
            {jobs.map((job) => {
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
          customerForm={customerForm}
          setCustomerForm={setCustomerForm}
          jobForm={jobForm}
          setJobForm={setJobForm}
          days={days}
          updateDay={updateDay}
          addDay={addDay}
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
    </MainLayout>
  );
}

function JobForm(props: any) {
  const {
    customers,
    employees,
    customerForm,
    setCustomerForm,
    jobForm,
    setJobForm,
    days,
    updateDay,
    addDay,
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

        <div className="grid grid-cols-2 gap-6">
          <div className="border rounded-xl p-4 space-y-3">
            <h3 className="font-bold text-lg">1. Khách hàng</h3>
            <select
              className="border p-3 rounded-lg w-full"
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
            </select>
            <input className="border p-3 rounded-lg w-full" placeholder="Tên khách đại diện / người book" value={customerForm.full_name} onChange={(e) => setCustomerForm({ ...customerForm, full_name: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <input className="border p-3 rounded-lg" placeholder="SĐT chính" value={customerForm.phone} onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })} />
              <input className="border p-3 rounded-lg" placeholder="SĐT phụ / SĐT cô dâu" value={customerForm.secondary_phone} onChange={(e) => setCustomerForm({ ...customerForm, secondary_phone: e.target.value })} />
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
            <div className="grid grid-cols-3 gap-3">
              <input type="number" className="border p-3 rounded-lg" placeholder="Tổng tiền hợp đồng" value={jobForm.total_price} onChange={(e) => setJobForm({ ...jobForm, total_price: Number(e.target.value) })} />
              <input type="number" className="border p-3 rounded-lg" placeholder="Đặt cọc / đã thu" value={jobForm.deposit} onChange={(e) => setJobForm({ ...jobForm, deposit: Number(e.target.value) })} />
              <input readOnly className="border p-3 rounded-lg bg-gray-50" placeholder="Còn nợ" value={Number(jobForm.total_price || 0) - Number(jobForm.deposit || 0)} />
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
              <div className="grid grid-cols-4 gap-3">
                <label className="text-sm text-gray-600">Ngày chụp {dayIndex + 1}<input type="date" className="border p-3 rounded-lg w-full mt-1" value={day.shooting_date} onChange={(e) => updateDay(dayIndex, "shooting_date", e.target.value)} /></label>
                <label className="text-sm text-gray-600">Từ giờ<input type="time" className="border p-3 rounded-lg w-full mt-1" value={day.start_time} onChange={(e) => updateDay(dayIndex, "start_time", e.target.value)} /></label>
                <label className="text-sm text-gray-600">Đến giờ<input type="time" className="border p-3 rounded-lg w-full mt-1" value={day.end_time} onChange={(e) => updateDay(dayIndex, "end_time", e.target.value)} /></label>
                <label className="text-sm text-gray-600">Ghi chú ngày<input className="border p-3 rounded-lg w-full mt-1" value={day.note} onChange={(e) => updateDay(dayIndex, "note", e.target.value)} placeholder="Ăn hỏi / tiệc / lưu ý timeline..." /></label>
              </div>

              <div className="flex justify-between items-center">
                <p className="font-semibold">Các địa điểm trong ngày này</p>
                <button onClick={() => addLocation(dayIndex)} className="bg-blue-600 text-white px-3 py-2 rounded-lg">+ Thêm địa chỉ / nhà gái</button>
              </div>

              {day.locations.map((location: any, locationIndex: number) => (
                <div key={locationIndex} className="border rounded-xl p-4 bg-white space-y-3">
                  <div className="grid grid-cols-12 gap-3 items-end">
                    <label className="text-sm text-gray-600 col-span-3">Tên địa điểm / nhà
                      <input className="border p-2 rounded-lg w-full mt-1" value={location.location_name} onChange={(e) => updateLocation(dayIndex, locationIndex, "location_name", e.target.value)} placeholder="Nhà trai / Nhà gái / Nhà hàng" />
                    </label>
                    <label className="text-sm text-gray-600 col-span-5">Địa chỉ
                      <input className="border p-2 rounded-lg w-full mt-1" value={location.address} onChange={(e) => updateLocation(dayIndex, locationIndex, "address", e.target.value)} placeholder="Xóm 1 Hoàng Xá / Giáp Long..." />
                    </label>
                    <label className="text-sm text-gray-600 col-span-3">SĐT tại địa điểm
                      <input className="border p-2 rounded-lg w-full mt-1" value={location.phone} onChange={(e) => updateLocation(dayIndex, locationIndex, "phone", e.target.value)} placeholder="0585557555" />
                    </label>
                    <button onClick={() => removeLocation(dayIndex, locationIndex)} className="text-red-600 col-span-1 pb-2">X</button>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => addAssignment(dayIndex, locationIndex, "Thợ chụp")} className="border px-3 py-1 rounded">+ Chụp</button>
                    <button onClick={() => addAssignment(dayIndex, locationIndex, "Thợ quay")} className="border px-3 py-1 rounded">+ Quay</button>
                    <button onClick={() => addAssignment(dayIndex, locationIndex, "Flycam")} className="border px-3 py-1 rounded">+ Flycam</button>
                    <button onClick={() => addAssignment(dayIndex, locationIndex, "Editor")} className="border px-3 py-1 rounded">+ Editor</button>
                  </div>

                  <div className="space-y-2">
                    {location.assignments.map((assignment: any, assignmentIndex: number) => (
                      <div key={assignmentIndex} className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-2 rounded-lg border">
                        <select className="border p-2 rounded col-span-2" value={assignment.role} onChange={(e) => updateAssignment(dayIndex, locationIndex, assignmentIndex, "role", e.target.value)}>
                          <option>Thợ chụp</option><option>Thợ quay</option><option>Flycam</option><option>Editor</option><option>Livestream</option><option>Makeup</option><option>Lái xe</option>
                        </select>
                        <select className="border p-2 rounded col-span-4" value={assignment.employee_id} onChange={(e) => {
                          const employee = employees.find((emp: any) => emp.id === e.target.value);
                          updateAssignment(dayIndex, locationIndex, assignmentIndex, "employee_id", e.target.value);
                          if (employee?.base_fee) updateAssignment(dayIndex, locationIndex, assignmentIndex, "salary_amount", Number(employee.base_fee));
                        }}>
                          <option value="">Chọn tên thợ</option>
                          {employees.map((employee: any) => <option key={employee.id} value={employee.id}>{employee.full_name} - {employee.role}</option>)}
                        </select>
                        <input type="number" className="border p-2 rounded col-span-2" value={assignment.salary_amount} onChange={(e) => updateAssignment(dayIndex, locationIndex, assignmentIndex, "salary_amount", Number(e.target.value))} placeholder="Lương" />
                        <input className="border p-2 rounded col-span-3" value={assignment.note} onChange={(e) => updateAssignment(dayIndex, locationIndex, assignmentIndex, "note", e.target.value)} placeholder="Ghi chú riêng cho thợ" />
                        <button onClick={() => removeAssignment(dayIndex, locationIndex, assignmentIndex)} className="text-red-600 col-span-1">X</button>
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
              <h3 className="font-bold mb-2">Ngày {index + 1}: {day.shooting_date} • {day.start_time} - {day.end_time}</h3>
              <p className="text-gray-600 mb-3">Địa điểm: {day.location}</p>
              <table className="w-full">
                <thead className="bg-slate-50"><tr><th className="text-left p-2">Địa điểm</th><th className="text-left p-2">Địa chỉ / SĐT</th><th className="text-left p-2">Vai trò</th><th className="text-left p-2">Thợ</th><th className="text-left p-2">Lương</th><th className="text-left p-2">Ghi chú</th></tr></thead>
                <tbody>
                  {(day.job_assignments || []).map((assignment: any) => (
                    <tr key={assignment.id} className="border-t">
                      <td className="p-2 font-semibold">{assignment.work_location_name}</td>
                      <td className="p-2"><div>{assignment.work_location_address}</div><div className="text-xs text-gray-500">{assignment.work_location_phone}</div></td>
                      <td className="p-2">{assignment.role}</td>
                      <td className="p-2">{assignment.employees?.full_name || "Chưa chọn"}</td>
                      <td className="p-2">{money(assignment.salary_amount)}</td>
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

          <button onClick={onClose} className="border px-4 py-2 rounded-lg">Đóng</button>
          <button onClick={onEdit} className="bg-yellow-500 text-white px-4 py-2 rounded-lg">Sửa job</button>
          <button onClick={onDelete} className="bg-red-600 text-white px-4 py-2 rounded-lg">Xóa job</button>
        </div>
      </div>
    </div>
  );
}
