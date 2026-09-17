"use client";

import { useEffect, useMemo, useState } from "react";
import MainLayout from "../components/layout/MainLayout";
import { supabase } from "@/lib/supabase";
import { getSession } from "@/lib/auth";

const categories = [
  { type: "raw_photo", label: "Ảnh gốc", editorCanEdit: false },
  { type: "raw_video", label: "Video gốc", editorCanEdit: false },
  { type: "edit_photo", label: "Ảnh hoàn thiện", editorCanEdit: true },
  { type: "final_video", label: "Video hoàn thiện", editorCanEdit: true },
  { type: "backup", label: "Backup", editorCanEdit: true },
] as const;

const money = (value: number | string | null | undefined) =>
  Number(value || 0).toLocaleString("vi-VN") + " đ";

const normalize = (value: any) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    alert("Đã sao chép link.");
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    document.body.removeChild(area);
    alert("Đã sao chép link.");
  }
};

export default function DrivePage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [editingFile, setEditingFile] = useState<any>(null);
  const [form, setForm] = useState({ file_url: "", note: "" });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "missing" | "ready" | "delivered">("all");
  const [role, setRole] = useState("");

  useEffect(() => {
    setRole(getSession()?.role || "");
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [{ data: jobData, error: jobError }, { data: fileData, error: fileError }] =
      await Promise.all([
        supabase
          .from("jobs")
          .select("*, customers(*), job_days(*)")
          .order("created_at", { ascending: false }),
        supabase.from("google_drive_files").select("*").order("created_at", { ascending: false }),
      ]);
    setLoading(false);
    if (jobError) return alert(jobError.message);
    if (fileError) return alert(fileError.message);
    setJobs(jobData || []);
    setFiles(fileData || []);
  };

  useEffect(() => {
    loadData();
  }, []);

  const filesByJob = useMemo(() => {
    const map: Record<string, any[]> = {};
    files.forEach((file) => {
      if (!map[file.job_id]) map[file.job_id] = [];
      map[file.job_id].push(file);
    });
    return map;
  }, [files]);

  const getFile = (jobId: string, type: string) =>
    (filesByJob[jobId] || []).find((file) => file.file_type === type);

  const isDelivered = (jobId: string) => Boolean(getFile(jobId, "delivery_status")?.file_url);
  const countLinks = (jobId: string) => categories.filter((cat) => getFile(jobId, cat.type)?.file_url).length;
  const hasFinalForCustomer = (jobId: string) =>
    Boolean(getFile(jobId, "edit_photo")?.file_url || getFile(jobId, "final_video")?.file_url);

  const canEditCategory = (category: (typeof categories)[number]) => {
    if (role === "admin") return true;
    if (role === "editor") return category.editorCanEdit;
    return false;
  };

  const openEditFile = (job: any, category: (typeof categories)[number]) => {
    if (!canEditCategory(category)) {
      alert("Tài khoản Editor chỉ được xem/copy file gốc và cập nhật file hoàn thiện + Backup.");
      return;
    }
    const file = getFile(job.id, category.type);
    setSelectedJob(job);
    setEditingFile({ ...category, file_id: file?.id });
    setForm({ file_url: file?.file_url || "", note: file?.note || "" });
  };

  const saveFile = async () => {
    if (!selectedJob || !editingFile) return;
    const url = form.file_url.trim();
    if (editingFile.file_id) {
      const { error } = await supabase
        .from("google_drive_files")
        .update({ file_name: editingFile.label, file_url: url, note: form.note })
        .eq("id", editingFile.file_id);
      if (error) return alert(error.message);
    } else {
      const { error } = await supabase.from("google_drive_files").insert([
        {
          job_id: selectedJob.id,
          file_name: editingFile.label,
          file_type: editingFile.type,
          file_url: url,
          note: form.note,
        },
      ]);
      if (error) return alert(error.message);
    }
    setEditingFile(null);
    setSelectedJob(null);
    setForm({ file_url: "", note: "" });
    await loadData();
  };

  const copyDeliveryMessage = async (job: any) => {
    const photo = getFile(job.id, "edit_photo");
    const video = getFile(job.id, "final_video");
    if (!photo?.file_url && !video?.file_url) {
      alert("Job này chưa có Ảnh hoàn thiện hoặc Video hoàn thiện để gửi khách.");
      return;
    }
    const text = [
      "BEEN MEDIA - GỬI QUÝ KHÁCH SẢN PHẨM",
      "",
      `Sự kiện: ${job.event_name || job.customer_name || ""}`,
      `Khách: ${job.customers?.full_name || job.customer_name || ""}`,
      photo?.file_url ? `Ảnh hoàn thiện: ${photo.file_url}` : null,
      video?.file_url ? `Video hoàn thiện: ${video.file_url}` : null,
      "",
      "Anh/chị kiểm tra giúp BEEN MEDIA và vui lòng tải sản phẩm về thiết bị cá nhân để lưu trữ. Cảm ơn quý khách đã sử dụng dịch vụ BEEN MEDIA.",
    ].filter(Boolean).join("\n");
    await copyText(text);
  };

  const markDelivered = async (job: any, delivered: boolean) => {
    if (role !== "admin") return alert("Chỉ Admin được thay đổi trạng thái giao khách.");
    const current = getFile(job.id, "delivery_status");
    if (current?.id) {
      const { error } = await supabase
        .from("google_drive_files")
        .update({
          file_name: "Trạng thái giao khách",
          file_url: delivered ? "delivered" : "",
          note: delivered ? `Đã giao khách lúc ${new Date().toLocaleString("vi-VN")}` : "",
        })
        .eq("id", current.id);
      if (error) return alert(error.message);
    } else if (delivered) {
      const { error } = await supabase.from("google_drive_files").insert([
        {
          job_id: job.id,
          file_name: "Trạng thái giao khách",
          file_type: "delivery_status",
          file_url: "delivered",
          note: `Đã giao khách lúc ${new Date().toLocaleString("vi-VN")}`,
        },
      ]);
      if (error) return alert(error.message);
    }
    await loadData();
  };

  const savedLinksCount = files.filter(
    (file) => categories.some((cat) => cat.type === file.file_type) && file.file_url
  ).length;
  const missingJobCount = jobs.filter((job) => countLinks(job.id) === 0).length;
  const deliveredJobCount = jobs.filter((job) => isDelivered(job.id)).length;

  const filteredJobs = useMemo(() => {
    const q = normalize(search);
    return jobs.filter((job) => {
      const haystack = normalize([
        job.event_name,
        job.job_code,
        job.service,
        job.customer_name,
        job.customer_phone,
        job.customers?.full_name,
        job.customers?.phone,
      ].join(" "));
      if (q && !haystack.includes(q)) return false;
      const links = countLinks(job.id);
      const delivered = isDelivered(job.id);
      if (filter === "missing") return links === 0;
      if (filter === "ready") return hasFinalForCustomer(job.id) && !delivered;
      if (filter === "delivered") return delivered;
      return true;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs, filesByJob, search, filter]);

  return (
    <MainLayout>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold">SẢN PHẨM</h1>
          <p className="mt-1 text-gray-500">Quản lý Ảnh gốc, Video gốc, Ảnh hoàn thiện, Video hoàn thiện và Backup theo từng Job.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm Job, khách, SĐT..."
            className="min-w-[260px] rounded-xl border bg-white px-4 py-2.5 outline-none focus:border-blue-500"
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="rounded-xl border bg-white px-4 py-2.5"
          >
            <option value="all">Tất cả Job</option>
            <option value="missing">Chưa gắn link</option>
            <option value="ready">Sẵn sàng giao</option>
            <option value="delivered">Đã giao khách</option>
          </select>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl bg-white p-5 shadow"><p className="text-gray-500">Tổng Job</p><p className="mt-2 text-3xl font-bold">{jobs.length}</p></div>
        <div className="rounded-xl bg-white p-5 shadow"><p className="text-gray-500">Link đã lưu</p><p className="mt-2 text-3xl font-bold text-green-600">{savedLinksCount}</p></div>
        <div className="rounded-xl bg-white p-5 shadow"><p className="text-gray-500">Job chưa gắn link</p><p className="mt-2 text-3xl font-bold text-red-600">{missingJobCount}</p><p className="mt-1 text-xs text-gray-400">Đếm theo Job, không đếm từng ô link</p></div>
        <div className="rounded-xl bg-white p-5 shadow"><p className="text-gray-500">Đã giao khách</p><p className="mt-2 text-3xl font-bold text-blue-600">{deliveredJobCount}</p></div>
      </div>

      <div className="overflow-x-auto rounded-xl bg-white p-4 shadow sm:p-6">
        <table className="w-full min-w-[1150px]">
          <thead>
            <tr className="border-b bg-slate-50">
              <th className="p-3 text-left">Job / Khách</th>
              <th className="p-3 text-left">Ngày chụp</th>
              {categories.map((cat) => <th key={cat.type} className="p-3 text-left">{cat.label}</th>)}
              <th className="p-3 text-left">Trạng thái</th>
              <th className="p-3 text-left">Giao khách</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={9} className="p-5 text-gray-500">Đang tải dữ liệu sản phẩm...</td></tr>}
            {!loading && filteredJobs.length === 0 && <tr><td colSpan={9} className="p-5 text-gray-500">Không có Job phù hợp bộ lọc.</td></tr>}
            {filteredJobs.map((job) => {
              const linkCount = countLinks(job.id);
              const delivered = isDelivered(job.id);
              const ready = hasFinalForCustomer(job.id);
              return (
                <tr key={job.id} className="border-b align-top hover:bg-slate-50">
                  <td className="p-3">
                    <div className="font-bold">{job.event_name || job.job_code}</div>
                    <div className="text-sm text-gray-600">{job.customers?.full_name || job.customer_name || ""}</div>
                    <div className="text-xs text-gray-400">{job.customers?.phone || job.customer_phone || ""}</div>
                  </td>
                  <td className="p-3 text-sm">{(job.job_days || []).map((d: any) => d.shooting_date).join(", ") || "Chưa có ngày"}</td>
                  {categories.map((cat) => {
                    const file = getFile(job.id, cat.type);
                    const editable = canEditCategory(cat);
                    return (
                      <td key={cat.type} className="p-3 text-sm">
                        {file?.file_url ? (
                          <div className="flex flex-col items-start gap-1.5">
                            <span className="rounded-full bg-green-100 px-2 py-1 text-[11px] font-bold text-green-700">Đã có</span>
                            <div className="flex flex-wrap gap-1">
                              <a href={file.file_url} target="_blank" rel="noreferrer" className="rounded border px-2 py-1 text-xs font-semibold text-blue-600">Mở</a>
                              <button onClick={() => copyText(file.file_url)} className="rounded bg-slate-800 px-2 py-1 text-xs text-white">Copy</button>
                              {editable && <button onClick={() => openEditFile(job, cat)} className="rounded bg-amber-500 px-2 py-1 text-xs text-white">Sửa</button>}
                            </div>
                          </div>
                        ) : editable ? (
                          <button onClick={() => openEditFile(job, cat)} className="rounded border px-2 py-1 text-xs hover:bg-blue-50">+ Dán link</button>
                        ) : (
                          <span className="text-xs text-gray-400">Chưa có</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="p-3">
                    {delivered ? (
                      <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-700">Đã giao khách</span>
                    ) : ready ? (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">Sẵn sàng giao</span>
                    ) : linkCount ? (
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">Đang cập nhật</span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">Chưa có link</span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex min-w-[120px] flex-col gap-2">
                      <button onClick={() => copyDeliveryMessage(job)} className="rounded bg-green-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50" disabled={!ready}>Copy gửi khách</button>
                      {role === "admin" && !delivered && <button onClick={() => markDelivered(job, true)} className="rounded border border-blue-600 px-3 py-2 text-xs font-semibold text-blue-700">Đánh dấu đã giao</button>}
                      {role === "admin" && delivered && <button onClick={() => markDelivered(job, false)} className="rounded border px-3 py-2 text-xs text-gray-600">Hoàn tác đã giao</button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editingFile && selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-[600px] rounded-xl bg-white p-6">
            <h2 className="mb-1 text-2xl font-bold">{editingFile.label}</h2>
            <p className="mb-4 text-gray-500">{selectedJob.event_name || selectedJob.customer_name}</p>
            <label className="mb-1 block text-sm text-gray-600">Link sản phẩm / Drive</label>
            <input className="mb-3 w-full rounded-lg border p-3" placeholder="Dán link vào đây" value={form.file_url} onChange={(e) => setForm({ ...form, file_url: e.target.value })}/>
            <label className="mb-1 block text-sm text-gray-600">Ghi chú</label>
            <textarea className="mb-5 w-full rounded-lg border p-3" placeholder="Ghi chú nội bộ..." value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })}/>
            <div className="flex justify-end gap-3">
              <button onClick={() => { setEditingFile(null); setSelectedJob(null); }} className="rounded-lg border px-4 py-2">Hủy</button>
              <button onClick={saveFile} className="rounded-lg bg-blue-600 px-4 py-2 text-white">Lưu link</button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
