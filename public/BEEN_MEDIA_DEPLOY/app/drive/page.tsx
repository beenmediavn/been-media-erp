"use client";

import { useEffect, useMemo, useState } from "react";
import MainLayout from "../components/layout/MainLayout";
import { supabase } from "@/lib/supabase";

const categories = [
  { type: "raw_photo", label: "Ảnh RAW" },
  { type: "raw_video", label: "Video RAW" },
  { type: "edit_photo", label: "Ảnh đã sửa" },
  { type: "final_video", label: "Video hoàn thiện" },
  { type: "album", label: "Album giao khách" },
  { type: "contract", label: "Hợp đồng" },
  { type: "receipt", label: "Phiếu thu" },
  { type: "design", label: "File thiết kế" },
  { type: "backup", label: "Backup" },
];

const money = (value: number | string | null | undefined) =>
  Number(value || 0).toLocaleString("vi-VN") + " đ";

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

  const openEditFile = (job: any, category: any) => {
    const file = getFile(job.id, category.type);
    setSelectedJob(job);
    setEditingFile({ ...category, file_id: file?.id });
    setForm({ file_url: file?.file_url || "", note: file?.note || "" });
  };

  const saveFile = async () => {
    if (!selectedJob || !editingFile) return;

    if (editingFile.file_id) {
      const { error } = await supabase
        .from("google_drive_files")
        .update({
          file_name: editingFile.label,
          file_url: form.file_url,
          note: form.note,
        })
        .eq("id", editingFile.file_id);

      if (error) return alert(error.message);
    } else {
      const { error } = await supabase.from("google_drive_files").insert([
        {
          job_id: selectedJob.id,
          file_name: editingFile.label,
          file_type: editingFile.type,
          file_url: form.file_url,
          note: form.note,
        },
      ]);

      if (error) return alert(error.message);
    }

    setEditingFile(null);
    setSelectedJob(null);
    setForm({ file_url: "", note: "" });
    loadData();
  };

  const copyDeliveryMessage = (job: any) => {
    const jobFiles = filesByJob[job.id] || [];
    const album = jobFiles.find((file) => file.file_type === "album");
    const finalVideo = jobFiles.find((file) => file.file_type === "final_video");

    const text = [
      "BEEN MEDIA - GỬI QUÝ KHÁCH LINK SẢN PHẨM",
      "",
      `Sự kiện: ${job.event_name || job.customer_name || ""}`,
      `Khách: ${job.customers?.full_name || job.customer_name || ""}`,
      album?.file_url ? `Album ảnh: ${album.file_url}` : "Album ảnh: Chưa có link",
      finalVideo?.file_url ? `Video hoàn thiện: ${finalVideo.file_url}` : "Video hoàn thiện: Chưa có link",
      "",
      "Anh/chị kiểm tra giúp BEEN MEDIA nhé. và vui lòng tải về lưu trữ tại thiết bị cá nhân tránh bị thất lạc, Cảm ơn quý khách đã sử dụng dịch vụ tại BEEN MEDIA.",
    ].join("\n");

    copyText(text);
  };

  const completedCount = files.filter((file) => file.file_url).length;

  return (
    <MainLayout>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Google Drive</h1>
          <p className="text-gray-500 mt-1">
            Quản lý link RAW, ảnh sửa, video dựng, album giao khách theo từng job
          </p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-5 shadow">
          <p className="text-gray-500">Tổng job</p>
          <p className="text-3xl font-bold mt-2">{jobs.length}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow">
          <p className="text-gray-500">Link đã lưu</p>
          <p className="text-3xl font-bold mt-2 text-green-600">{completedCount}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow">
          <p className="text-gray-500">Doanh thu job</p>
          <p className="text-2xl font-bold mt-2">
            {money(jobs.reduce((sum, job) => sum + Number(job.total_price || 0), 0))}
          </p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow">
          <p className="text-gray-500">Chưa gắn link</p>
          <p className="text-3xl font-bold mt-2 text-red-600">
            {Math.max(jobs.length * categories.length - completedCount, 0)}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-6 overflow-x-auto">
        <table className="w-full min-w-[1300px]">
          <thead>
            <tr className="border-b bg-slate-50">
              <th className="text-left p-3">Job</th>
              <th className="text-left p-3">Khách</th>
              <th className="text-left p-3">Ngày chụp</th>
              {categories.map((cat) => (
                <th key={cat.type} className="text-left p-3">{cat.label}</th>
              ))}
              <th className="text-left p-3">Giao khách</th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td colSpan={13} className="p-4 text-gray-500">Đang tải dữ liệu Drive...</td>
              </tr>
            )}

            {!loading && jobs.length === 0 && (
              <tr>
                <td colSpan={13} className="p-4 text-gray-500">Chưa có job để gắn link Drive.</td>
              </tr>
            )}

            {jobs.map((job) => (
              <tr key={job.id} className="border-b hover:bg-slate-50 align-top">
                <td className="p-3">
                  <div className="font-bold">{job.event_name || job.job_code}</div>
                  <div className="text-xs text-gray-500">{job.service}</div>
                </td>
                <td className="p-3">
                  <div>{job.customers?.full_name || job.customer_name}</div>
                  <div className="text-xs text-gray-500">{job.customers?.phone || job.customer_phone}</div>
                </td>
                <td className="p-3 text-sm">
                  {(job.job_days || []).map((day: any) => day.shooting_date).join(", ") || "Chưa có ngày"}
                </td>

                {categories.map((cat) => {
                  const file = getFile(job.id, cat.type);
                  return (
                    <td key={cat.type} className="p-3 text-sm">
                      {file?.file_url ? (
                        <div className="space-y-1">
                          <a
                            href={file.file_url}
                            target="_blank"
                            className="text-blue-600 font-semibold underline"
                          >
                            Mở
                          </a>
                          <button
                            onClick={() => copyText(file.file_url)}
                            className="block text-xs bg-slate-800 text-white px-2 py-1 rounded"
                          >
                            Copy
                          </button>
                          <button
                            onClick={() => openEditFile(job, cat)}
                            className="block text-xs bg-yellow-500 text-white px-2 py-1 rounded"
                          >
                            Sửa
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => openEditFile(job, cat)}
                          className="text-xs border px-2 py-1 rounded hover:bg-blue-50"
                        >
                          + Link
                        </button>
                      )}
                    </td>
                  );
                })}

                <td className="p-3">
                  <button
                    onClick={() => copyDeliveryMessage(job)}
                    className="bg-green-600 text-white px-3 py-1 rounded text-sm"
                  >
                    Copy gửi khách
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingFile && selectedJob && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-[600px]">
            <h2 className="text-2xl font-bold mb-1">{editingFile.label}</h2>
            <p className="text-gray-500 mb-4">
              {selectedJob.event_name || selectedJob.customer_name}
            </p>

            <label className="block text-sm text-gray-600 mb-1">Link Google Drive</label>
            <input
              className="border p-3 rounded-lg w-full mb-3"
              placeholder="Dán link Google Drive vào đây"
              value={form.file_url}
              onChange={(e) => setForm({ ...form, file_url: e.target.value })}
            />

            <label className="block text-sm text-gray-600 mb-1">Ghi chú</label>
            <textarea
              className="border p-3 rounded-lg w-full mb-5"
              placeholder="Ví dụ: đã giao khách, chờ editor, link RAW full..."
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setEditingFile(null);
                  setSelectedJob(null);
                }}
                className="border px-4 py-2 rounded-lg"
              >
                Hủy
              </button>
              <button onClick={saveFile} className="bg-blue-600 text-white px-4 py-2 rounded-lg">
                Lưu link
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
