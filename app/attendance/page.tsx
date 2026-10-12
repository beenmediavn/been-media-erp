"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import MainLayout from "../components/layout/MainLayout";
import { getSession, type AppUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { Camera, CheckCircle2, Clock3, Image as ImageIcon, LogIn, LogOut, RefreshCcw, Upload, AlertTriangle, X } from "lucide-react";
import { formatDateTimeVN, formatDateVN } from "@/lib/date-vn";

const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

type CaptureMode = "checkin_face" | "checkin_customer" | "checkout";

export default function AttendancePage() {
  const [user, setUser] = useState<AppUser | null>(null);
  useEffect(() => setUser(getSession()), []);
  if (!user) return <MainLayout><div className="p-6">Đang tải...</div></MainLayout>;
  return <MainLayout><AttendanceApp user={user} /></MainLayout>;
}

function AttendanceApp({ user }: { user: AppUser }) {
  const admin = user.role === "admin";
  const [date, setDate] = useState(localDate());
  const [assignments, setAssignments] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [penalties, setPenalties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [capture, setCapture] = useState<{ mode: CaptureMode; assignment: any } | null>(null);
  const [reviewModal, setReviewModal] = useState<any>(null); // Modal phạt thợ cho Admin
  const [penaltyAmount, setPenaltyAmount] = useState(100000);
  const [penaltyNote, setPenaltyNote] = useState("");

  async function load() {
    setLoading(true);
    setLoadError("");
    let q = supabase
      .from("job_assignments")
      .select("*, employees(id, full_name, role), jobs(id, event_name, customer_name, status, service), job_days(id, shooting_date, start_time, end_time, location)")
      .order("created_at", { ascending: true });

    if (!admin) q = q.eq("employee_id", user.id);

    const [
      { data: ass, error },
      { data: att },
      { data: adj }
    ] = await Promise.all([
      q,
      admin
        ? supabase.from("attendance_records").select("*, employees(full_name, role), jobs(event_name, customer_name, service), job_days(shooting_date, start_time, end_time)").order("check_in_at", { ascending: false })
        : supabase.from("attendance_records").select("*").eq("employee_id", user.id).order("check_in_at", { ascending: false }),
      supabase.from("salary_adjustments").select("*").eq("adjustment_type", "penalty")
    ]);

    if (error) {
      setLoadError(error.message);
      if (navigator.onLine) console.error("Attendance load error", error);
    }
    setAssignments((ass || []).filter((a: any) => a.job_days?.shooting_date === date));
    setRecords(att || []);
    setPenalties(adj || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [date, user.id, user.role]);

  const recordByAssignment = useMemo(() => new Map(records.map((r: any) => [r.assignment_id, r])), [records]);
  const visibleRecords = useMemo(
    () => records.filter((r: any) => (r.job_days?.shooting_date ? r.job_days.shooting_date === date : assignments.some((a: any) => a.id === r.assignment_id))),
    [records, assignments, date]
  );

  function openCapture(mode: CaptureMode, a: any) {
    if (mode === "checkout") {
      const r = recordByAssignment.get(a.id);
      if (!r?.check_in_at) {
        alert("Bạn phải Check-in trước khi Check-out.");
        return;
      }
      if (!r?.check_in_customer_url && !confirm("Bạn chưa gửi ảnh cùng khách hàng. Vẫn tiếp tục Check-out? Hệ thống sẽ cảnh báo thiếu ảnh.")) return;
    }
    setCapture({ mode, assignment: a });
  }

  async function saveCapture(blob: Blob, mode: CaptureMode, a: any) {
    const ext = "jpg";
    const filename = `${a.employee_id}/${a.job_id}/${a.id}/${Date.now()}-${mode}.${ext}`;
    const { error: upErr } = await supabase.storage.from("attendance").upload(filename, blob, { contentType: "image/jpeg", upsert: false });
    if (upErr) {
      alert("Không tải được ảnh: " + upErr.message);
      return false;
    }
    const { data: urlData } = supabase.storage.from("attendance").getPublicUrl(filename);
    const url = urlData.publicUrl;
    const now = new Date();
    const existing = recordByAssignment.get(a.id);

    if (mode === "checkin_face") {
      const start = a.job_days?.start_time;
      let late = 0;
      if (start) {
        const [h, m] = String(start).split(":").map(Number);
        const scheduled = new Date(`${a.job_days.shooting_date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`);
        late = Math.max(Math.floor((now.getTime() - scheduled.getTime()) / 60000), 0);
      }
      const payload = {
        assignment_id: a.id,
        job_id: a.job_id,
        job_day_id: a.job_day_id,
        employee_id: a.employee_id,
        check_in_at: now.toISOString(),
        check_in_face_url: url,
        late_minutes: late,
        status: late > 0 ? "checked_in_late" : "checked_in",
      };
      const { error } = existing
        ? await supabase.from("attendance_records").update(payload).eq("id", existing.id)
        : await supabase.from("attendance_records").insert([payload]);
      if (error) { alert(error.message); return false; }
      alert("Đã CHECK-IN thành công! Hãy chụp hoặc tải ảnh cùng khách hàng để hoàn tất.");
    } else if (mode === "checkin_customer") {
      if (!existing) { alert("Hãy Check-in khuôn mặt trước."); return false; }
      const { error } = await supabase.from("attendance_records").update({ check_in_customer_url: url, status: "customer_photo_done" }).eq("id", existing.id);
      if (error) { alert(error.message); return false; }
      alert("Đã gửi ảnh cùng khách hàng về Studio thành công.");
    } else {
      if (!existing) { alert("Không tìm thấy lượt Check-in."); return false; }
      const { error } = await supabase.from("attendance_records").update({ check_out_at: now.toISOString(), check_out_photo_url: url, status: "checked_out" }).eq("id", existing.id);
      if (error) { alert(error.message); return false; }
      alert("Đã CHECK-OUT hoàn thành ca làm việc.");
    }
    setCapture(null);
    await load();
    return true;
  }

  // Xử lý trừ lương vi phạm chấm công
  async function handleApplyPenalty() {
    if (!reviewModal) return;
    const { employee_id, job_id, id: record_id, note_default } = reviewModal;
    const amount = -Math.abs(Number(penaltyAmount || 100000));
    const reason = penaltyNote.trim() || note_default || "Vi phạm chấm công (thiếu ảnh / muộn giờ)";

    const { error } = await supabase.from("salary_adjustments").insert([
      {
        employee_id,
        job_id,
        adjustment_date: date,
        adjustment_type: "penalty",
        amount,
        note: `[Phạt Chấm công] ${reason}`,
        received_by_studio: true,
      },
    ]);

    if (error) {
      alert("Lỗi khi trừ lương: " + error.message);
      return;
    }

    // Đánh dấu bản ghi đã phạt
    await supabase.from("attendance_records").update({ status: "penalized" }).eq("id", record_id);
    alert(`Đã trừ ${Math.abs(amount).toLocaleString("vi-VN")} đ vào bảng lương của nhân sự!`);
    setReviewModal(null);
    load();
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-black sm:text-3xl text-slate-800">CHẤM CÔNG</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Check-in/out bắt buộc camera thường • Tải ảnh cùng khách từ máy • Đánh giá & trừ lương thợ
          </p>
        </div>
        <label className="text-xs sm:text-sm font-semibold text-slate-700">
          Ngày
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="ml-2 rounded-xl border bg-white p-2 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500"
          />
        </label>
      </div>

      {loadError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700">
          Lỗi tải dữ liệu chấm công: {loadError}
        </div>
      )}

      {admin ? (
        <AdminView
          assignments={assignments}
          records={visibleRecords}
          recordByAssignment={recordByAssignment}
          penalties={penalties}
          onOpenReview={(data: any) => {
            setReviewModal(data);
            setPenaltyAmount(100000);
            setPenaltyNote(data.note_default || "");
          }}
        />
      ) : (
        <WorkerView
          assignments={assignments}
          recordByAssignment={recordByAssignment}
          openCapture={openCapture}
        />
      )}

      {loading && (
        <div className="rounded-2xl bg-white p-6 text-center text-xs text-slate-500">
          Đang tải dữ liệu chấm công...
        </div>
      )}

      {/* POPUP CHỤP ẢNH / TẢI ẢNH (NÚT X DÍNH TRÊN ĐẦU) */}
      {capture && (
        <CameraCapture
          mode={capture.mode}
          assignment={capture.assignment}
          onClose={() => setCapture(null)}
          onCapture={(blob) => saveCapture(blob, capture.mode, capture.assignment)}
        />
      )}

      {/* MODAL ADMIN ĐÁNH GIÁ & TRỪ LƯƠNG */}
      {reviewModal && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="sticky top-0 flex items-center justify-between border-b bg-white px-5 py-4">
              <h3 className="font-bold text-base text-slate-800">Đánh giá vi phạm Chấm công</h3>
              <button
                onClick={() => setReviewModal(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 font-bold"
              >
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs">
              <div className="rounded-xl bg-amber-50 p-3 border border-amber-200 text-amber-900">
                <p><b>Nhân sự:</b> {reviewModal.employee_name}</p>
                <p className="mt-1"><b>Lý do:</b> {reviewModal.note_default}</p>
              </div>

              <div>
                <label className="block font-semibold mb-1">Mức tiền trừ lương (VNĐ)</label>
                <input
                  type="number"
                  step="10000"
                  value={penaltyAmount}
                  onChange={(e) => setPenaltyAmount(Number(e.target.value))}
                  className="w-full rounded-xl border p-2.5 font-bold text-rose-600 focus:ring-2 focus:ring-blue-500"
                  placeholder="100000"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Mặc định gợi ý 100.000 đ</span>
              </div>

              <div>
                <label className="block font-semibold mb-1">Ghi chú phạt</label>
                <input
                  value={penaltyNote}
                  onChange={(e) => setPenaltyNote(e.target.value)}
                  placeholder="Lý do trừ lương..."
                  className="w-full rounded-xl border p-2.5 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setReviewModal(null)}
                  className="flex-1 rounded-xl border py-2.5 font-semibold hover:bg-slate-50"
                >
                  Bỏ qua
                </button>
                <button
                  onClick={handleApplyPenalty}
                  className="flex-1 rounded-xl bg-rose-600 py-2.5 font-bold text-white hover:bg-rose-700 shadow-sm"
                >
                  Xác nhận trừ lương
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WorkerView({
  assignments,
  recordByAssignment,
  openCapture,
}: {
  assignments: any[];
  recordByAssignment: Map<any, any>;
  openCapture: (m: CaptureMode, a: any) => void;
}) {
  if (!assignments.length) {
    return <div className="rounded-3xl bg-white p-8 text-center text-slate-500">Hôm nay bạn chưa có Job được phân công.</div>;
  }

  return (
    <div className="space-y-4">
      {assignments.map((a) => {
        const r = recordByAssignment.get(a.id);
        const missingCustomer = !!r?.check_in_at && !r?.check_in_customer_url;
        const missingCheckout = !!r?.check_in_at && !r?.check_out_photo_url;

        return (
          <div key={a.id} className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-800">
                  {a.jobs?.event_name || a.jobs?.customer_name || "Job"}
                </h2>
                <p className="text-xs text-slate-500">
                  {formatDateVN(a.job_days?.shooting_date)} • {a.job_days?.start_time || "--:--"} - {a.job_days?.end_time || "--:--"} • {a.role}
                </p>
              </div>
              <AttendanceBadge r={r} />
            </div>

            {/* BẢNG CẢNH BÁO NỔI BẬT DÀNH CHO THỢ */}
            {(missingCustomer || missingCheckout) && (
              <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-semibold text-amber-900">
                <AlertTriangle className="text-amber-600 shrink-0" size={18} />
                <span>
                  <b>CẢNH BÁO:</b>{" "}
                  {missingCustomer && !missingCheckout
                    ? "Bạn chưa gửi ảnh chụp cùng khách hàng! Vui lòng tải ảnh lên tránh bị trừ lương."
                    : missingCustomer && missingCheckout
                    ? "Bạn đang thiếu ảnh chụp cùng khách hàng!"
                    : "Đến giờ kết thúc ca, hãy Check-out hoàn thành Job."}
                </span>
              </div>
            )}

            <div className="grid gap-3 lg:grid-cols-3">
              {/* BƯỚC 1: CHECK-IN BẮT BUỘC CAMERA */}
              <Step
                title="1. CHECK-IN KHUÔN MẶT"
                done={!!r?.check_in_face_url}
                text={
                  r?.check_in_at
                    ? `Đã Check-in ${formatDateTimeVN(r.check_in_at)}${r.late_minutes > 0 ? ` • Muộn ${r.late_minutes} phút` : " • Đúng giờ"}`
                    : "Đến Job → Bắt buộc mở Camera thường trực tiếp để chụp ảnh khuôn mặt."
                }
                photo={r?.check_in_face_url}
              >
                <button
                  disabled={!!r?.check_in_at}
                  onClick={() => openCapture("checkin_face", a)}
                  className="w-full rounded-xl bg-blue-600 px-4 py-2.5 font-bold text-white text-xs disabled:bg-slate-300 flex items-center justify-center gap-1.5"
                >
                  <LogIn size={16} />
                  {r?.check_in_at ? "Đã Check-in" : "Mở camera Check-in"}
                </button>
              </Step>

              {/* BƯỚC 2: ẢNH CÙNG KHÁCH (CHO PHÉP TẢI ẢNH TỪ MÁY) */}
              <Step
                title="2. ẢNH CÙNG KHÁCH HÀNG"
                done={!!r?.check_in_customer_url}
                warn={missingCustomer}
                text={
                  r?.check_in_customer_url
                    ? "Đã gửi ảnh cùng khách về Studio."
                    : "Chụp trực tiếp hoặc tải ảnh đẹp từ điện thoại/máy tính để đăng Facebook."
                }
                photo={r?.check_in_customer_url}
              >
                <button
                  disabled={!r?.check_in_at || !!r?.check_in_customer_url}
                  onClick={() => openCapture("checkin_customer", a)}
                  className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 font-bold text-white text-xs disabled:bg-slate-300 flex items-center justify-center gap-1.5"
                >
                  <Upload size={16} />
                  {r?.check_in_customer_url ? "Đã gửi ảnh" : "Chụp hoặc Tải ảnh từ máy"}
                </button>
              </Step>

              {/* BƯỚC 3: CHECK-OUT BẮT BUỘC CAMERA */}
              <Step
                title="3. CHECK-OUT HOÀN THÀNH"
                done={!!r?.check_out_photo_url}
                warn={missingCheckout}
                text={
                  r?.check_out_at
                    ? `Hoàn thành ${formatDateTimeVN(r.check_out_at)}`
                    : "Xong Job, bắt buộc mở camera thường chụp tại không gian làm việc để Check-out."
                }
                photo={r?.check_out_photo_url}
              >
                <button
                  disabled={!r?.check_in_at || !!r?.check_out_at}
                  onClick={() => openCapture("checkout", a)}
                  className="w-full rounded-xl bg-orange-600 px-4 py-2.5 font-bold text-white text-xs disabled:bg-slate-300 flex items-center justify-center gap-1.5"
                >
                  <LogOut size={16} />
                  {r?.check_out_at ? "Đã Check-out" : "Mở camera Check-out"}
                </button>
              </Step>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AdminView({
  assignments,
  records,
  recordByAssignment,
  penalties,
  onOpenReview,
}: {
  assignments: any[];
  records: any[];
  recordByAssignment: Map<any, any>;
  penalties: any[];
  onOpenReview: (data: any) => void;
}) {
  const checked = assignments.filter((a) => recordByAssignment.get(a.id)?.check_in_at).length;
  const done = assignments.filter((a) => recordByAssignment.get(a.id)?.check_out_at).length;
  const missingCustomer = assignments.filter((a) => {
    const r = recordByAssignment.get(a.id);
    return r?.check_in_at && !r?.check_in_customer_url;
  }).length;

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Lượt phải đi Job" value={assignments.length} />
        <Stat label="Đã Check-in" value={checked} />
        <Stat label="Đã Check-out" value={done} />
        <Stat label="Thiếu ảnh cùng khách" value={missingCustomer} warn />
      </div>

      <div className="space-y-3">
        {assignments.map((a) => {
          const r = recordByAssignment.get(a.id);
          const hasMissingCustomer = !!r?.check_in_at && !r?.check_in_customer_url;
          const hasLate = Number(r?.late_minutes || 0) > 0;
          const isPenalized = r?.status === "penalized";

          return (
            <div key={a.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
              <div className="flex flex-wrap items-start justify-between gap-2 border-b pb-3">
                <div>
                  <b className="text-sm text-slate-800">{a.employees?.full_name || "Nhân sự"}</b>
                  <p className="text-xs text-slate-500">
                    {a.jobs?.event_name || a.jobs?.customer_name || "Job"} • {a.role} • {a.job_days?.start_time || "--:--"} - {a.job_days?.end_time || "--:--"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <AttendanceBadge r={r} />
                  {/* NÚT ADMIN ĐÁNH GIÁ & TRỪ LƯƠNG NẾU THIẾU HẠNG MỤC HOẶC MUỘN */}
                  {(hasMissingCustomer || hasLate || !r?.check_in_at) && (
                    <button
                      onClick={() =>
                        onOpenReview({
                          employee_id: a.employee_id,
                          employee_name: a.employees?.full_name,
                          job_id: a.job_id,
                          id: r?.id,
                          note_default: hasMissingCustomer
                            ? "Thiếu ảnh chụp cùng khách hàng"
                            : hasLate
                            ? `Đi muộn ${r.late_minutes} phút`
                            : "Chưa thực hiện Check-in theo quy định",
                        })
                      }
                      className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                        isPenalized
                          ? "bg-slate-100 text-slate-500 cursor-not-allowed"
                          : "bg-rose-50 text-rose-700 border border-rose-300 hover:bg-rose-100"
                      }`}
                    >
                      {isPenalized ? "Đã trừ lương" : "⚡ Đánh giá vi phạm"}
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <AdminPhoto title="Ảnh mặt Check-in" url={r?.check_in_face_url} time={r?.check_in_at} />
                <AdminPhoto title="Ảnh cùng khách" url={r?.check_in_customer_url} warn={hasMissingCustomer} />
                <AdminPhoto title="Ảnh Check-out" url={r?.check_out_photo_url} time={r?.check_out_at} warn={!!r?.check_in_at && !r?.check_out_photo_url} />
              </div>

              {hasLate && (
                <p className="mt-2 text-xs font-bold text-rose-600">⚠ Đi muộn {r.late_minutes} phút so với giờ bắt đầu ca</p>
              )}
            </div>
          );
        })}
        {!assignments.length && (
          <div className="rounded-3xl bg-white p-8 text-center text-slate-500">
            Không có nhân sự phải đi Job trong ngày này.
          </div>
        )}
      </div>
    </>
  );
}

function CameraCapture({
  mode,
  assignment,
  onClose,
  onCapture,
}: {
  mode: CaptureMode;
  assignment: any;
  onClose: () => void;
  onCapture: (b: Blob) => Promise<boolean>;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<"user" | "environment">(
    mode === "checkin_customer" || mode === "checkout" ? "environment" : "user"
  );
  const [saving, setSaving] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState("");

  const isCustomerMode = mode === "checkin_customer";

  async function start() {
    setError("");
    setCameraReady(false);
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Trình duyệt không hỗ trợ camera");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facing } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraReady(true);
      }
    } catch {
      setError("Không thể bật camera trực tiếp. Bạn có thể dùng nút chụp phía dưới.");
    }
  }

  useEffect(() => {
    start();
    return () => streamRef.current?.getTracks().forEach((t) => t.stop());
  }, [facing]);

  async function submitBlob(blob: Blob) {
    setSaving(true);
    try {
      await onCapture(blob);
    } finally {
      setSaving(false);
    }
  }

  async function snap() {
    const v = videoRef.current,
      c = canvasRef.current;
    if (!v || !c || !v.videoWidth) {
      fileRef.current?.click();
      return;
    }
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")?.drawImage(v, 0, 0);
    c.toBlob(async (blob) => {
      if (blob) await submitBlob(blob);
    }, "image/jpeg", 0.85);
  }

  async function choosePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Vui lòng chọn một tệp ảnh.");
      return;
    }
    await submitBlob(file);
  }

  const copy =
    mode === "checkin_face"
      ? "Bắt buộc mở camera thường chụp rõ mặt để CHECK-IN"
      : mode === "checkin_customer"
      ? "Chụp trực tiếp hoặc tải ảnh từ máy tính/điện thoại"
      : "Bắt buộc mở camera thường chụp tại không gian làm việc để CHECK-OUT";

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header dính trên đầu có nút X */}
        <div className="sticky top-0 z-20 flex items-start justify-between border-b bg-white p-4 rounded-t-3xl">
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-800">
              📸 {mode === "checkout" ? "ẢNH CHECK-OUT" : mode === "checkin_customer" ? "ẢNH CÙNG KHÁCH" : "ẢNH CHECK-IN"}
            </h2>
            <p className="text-xs font-semibold text-blue-700 mt-0.5">{copy}</p>
            <p className="text-[11px] text-slate-400">{assignment.jobs?.event_name || assignment.jobs?.customer_name || "Job"}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 font-bold"
          >
            <X size={20} />
          </button>
        </div>

        <div className="relative min-h-56 bg-black flex-1 flex items-center justify-center">
          <video ref={videoRef} playsInline muted className="max-h-[50vh] min-h-56 w-full object-contain" />
          {!cameraReady && (
            <div className="absolute inset-0 grid place-items-center p-6 text-center text-xs text-white/80">
              Đang kết nối camera...<br />Nếu không mở được, hãy bấm nút thao tác bên dưới.
            </div>
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {error && <p className="mx-4 mt-2 rounded-xl bg-amber-50 p-2.5 text-xs font-semibold text-amber-800">{error}</p>}

        {/* Cấu hình file upload: Riêng mode cùng khách cho phép chọn từ thư viện */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture={isCustomerMode ? undefined : (facing as any)}
          onChange={choosePhoto}
          className="hidden"
        />

        <div className="grid gap-2 p-4 sm:grid-cols-2">
          {isCustomerMode ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => fileRef.current?.click()}
              className="rounded-xl bg-emerald-600 px-3 py-3 font-bold text-white text-xs disabled:bg-slate-400 flex items-center justify-center gap-1.5"
            >
              <Upload size={17} />
              {saving ? "Đang tải ảnh..." : "CHỌN ẢNH TỪ MÁY / ĐIỆN THOẠI"}
            </button>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={() => fileRef.current?.click()}
              className="rounded-xl bg-emerald-600 px-3 py-3 font-bold text-white text-xs disabled:bg-slate-400 flex items-center justify-center gap-1.5"
            >
              <Camera size={17} />
              {saving ? "Đang gửi..." : "MỞ CAMERA ĐIỆN THOẠI CHỤP"}
            </button>
          )}

          <button
            type="button"
            disabled={saving}
            onClick={snap}
            className="rounded-xl bg-blue-600 px-3 py-3 font-bold text-white text-xs disabled:bg-slate-400 flex items-center justify-center gap-1.5"
          >
            <Camera size={17} />
            {saving ? "Đang gửi..." : "CHỤP & GỬI VỀ STUDIO"}
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={() => setFacing((v) => (v === "user" ? "environment" : "user"))}
            className="rounded-xl border px-3 py-2.5 font-semibold text-xs sm:col-span-2 flex items-center justify-center gap-1.5 hover:bg-slate-50"
          >
            <RefreshCcw size={15} />
            Đổi camera trước / sau
          </button>
        </div>
      </div>
    </div>
  );
}

function AttendanceBadge({ r }: { r: any }) {
  if (!r?.check_in_at) return <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">Chưa Check-in</span>;
  if (r.status === "penalized") return <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-700">⚠ Bị trừ lương</span>;
  if (r.check_out_at) return <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">✓ Đã Check-out</span>;
  if (!r.check_in_customer_url) return <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">⚠ Thiếu ảnh cùng khách</span>;
  return <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">Đang ở Job</span>;
}

function Step({ title, done, warn = false, text, photo, children }: { title: string; done: boolean; warn?: boolean; text: string; photo?: string; children: any }) {
  return (
    <div className={`rounded-2xl border p-3 flex flex-col justify-between ${done ? "border-emerald-200 bg-emerald-50/60" : warn ? "border-amber-300 bg-amber-50" : "bg-slate-50"}`}>
      <div>
        <div className="mb-2 flex items-center gap-2 font-black text-xs text-slate-800">
          {done ? <CheckCircle2 className="text-emerald-600" size={17} /> : <Clock3 size={17} />}
          {title}
        </div>
        {photo && <img src={photo} alt={title} className="mb-2.5 h-36 w-full rounded-xl object-cover border" />}
        <p className="mb-3 text-[11px] text-slate-600 min-h-8">{text}</p>
      </div>
      <div>{children}</div>
    </div>
  );
}

function AdminPhoto({ title, url, time, warn = false }: { title: string; url?: string; time?: string; warn?: boolean }) {
  return (
    <div className={`rounded-xl border p-2 ${warn ? "border-amber-300 bg-amber-50" : "bg-slate-50"}`}>
      <p className="mb-1.5 text-xs font-bold text-slate-700">{title}</p>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer">
          <img src={url} alt={title} className="h-28 w-full rounded-lg object-cover border" />
        </a>
      ) : (
        <div className="grid h-28 place-items-center rounded-lg bg-slate-100 text-xs text-slate-400">
          <ImageIcon size={22} />
          <span>{warn ? "THIẾU ẢNH" : "Chưa có"}</span>
        </div>
      )}
      {time && <p className="mt-1 text-[10px] text-slate-500">{formatDateTimeVN(time)}</p>}
    </div>
  );
}

function Stat({ label, value, warn = false }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ${warn && value > 0 ? "ring-amber-300" : "ring-slate-100"}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <b className={`text-2xl ${warn && value > 0 ? "text-amber-600" : "text-slate-900"}`}>{value}</b>
    </div>
  );
}
