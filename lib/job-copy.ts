// Shared admin clipboard formatting for Schedule and Job details.
const money = (value: any) => Number(value || 0).toLocaleString("vi-VN") + " đ";
const clean = (value: any): string => String(value ?? "").trim();
const dateVN = (value: any) => {
  const date = clean(value).slice(0, 10).split("-");
  return date.length === 3 ? date.reverse().join("/") : "Chưa có ngày";
};
const side = (name: string) => name.toLocaleLowerCase("vi").includes("trai") ? "groom"
  : name.toLocaleLowerCase("vi").includes("gái") ? "bride" : "";

export function jobCopyHeader(job: any): string[] {
  return ["📸 [BEEN MEDIA] – THÔNG TIN JOB",
    `Sự kiện: ${job.event_name || job.customer_name || job.customers?.full_name || "Chưa có"}`,
    `Mã Job: ${job.job_code || "Chưa có"}`,
    `Dịch vụ: ${job.service || "Chưa có"}`,
    `Khách hàng: ${job.customers?.full_name || job.customer_name || "Chưa có"}`];
}

export function jobCopyDay(job: any, day: any, index: number): string[] {
  const groups: Array<{ name: string; address: string; phone: string; note: string; assignments: any[] }> = [];
  const fallback = (name: string) => side(name) === "groom"
    ? clean(job.customers?.phone || job.customer_phone)
    : side(name) === "bride" ? clean(job.customers?.secondary_phone || job.secondary_phone) : "";
  for (const location of day.job_locations || []) {
    const name = clean(location.location_name) || "Địa điểm";
    groups.push({ name, address: clean(location.address), phone: clean(location.phone) || fallback(name),
      note: clean(location.note), assignments: [] });
  }
  for (const assignment of day.job_assignments || []) {
    const name = clean(assignment.work_location_name);
    const address = clean(assignment.work_location_address);
    const phone = clean(assignment.work_location_phone);
    const candidates = groups.filter(group => name && group.name === name);
    let group = candidates.find(group => address && group.address === address)
      || (candidates.length === 1 && (!address || !candidates[0].address) ? candidates[0] : undefined);
    if (!group) {
      group = { name: name || "Chưa xác định địa điểm", address, phone: phone || fallback(name), note: "", assignments: [] };
      groups.push(group);
    }
    if (!group.address) group.address = address;
    if (!group.phone) group.phone = phone;
    group.assignments.push(assignment);
  }
  const lines = ["", `📅 Ngày ${index + 1}${day.note ? ` – ${day.note}` : ""}`,
    `🗓 ${dateVN(day.shooting_date)}`, `⏰ ${clean(day.start_time).slice(0, 5) || "--:--"} – ${clean(day.end_time).slice(0, 5) || "--:--"}`];
  if (!groups.length) lines.push(`📍 ${day.location || "Chưa có địa điểm"}`, "Chưa phân công thợ");
  for (const group of groups) {
    lines.push("", `🏠 ${group.name.toLocaleUpperCase("vi")}`, `📍 ${group.address || "Chưa nhập địa chỉ"}`, `☎️ ${group.phone || "Chưa có SĐT"}`);
    if (group.note) lines.push(`📝 Ghi chú địa điểm: ${group.note}`);
    if (!group.assignments.length) lines.push("Chưa phân công thợ");
    for (const assignment of group.assignments) {
      lines.push(`- ${assignment.role || "Thợ"}: ${assignment.employees?.full_name || "Chưa chọn"} | Lương: ${money(assignment.salary_amount)}`);
      if (assignment.note) lines.push(`  📝 Ghi chú: ${assignment.note}`);
    }
  }
  return lines;
}

export function formatDayJobCopy(job: any, day: any, index: number): string {
  return [...jobCopyHeader(job), ...jobCopyDay(job, day, index)].join("\n");
}

export function formatFullJobCopy(job: any): string {
  const debt = job.debt ?? Math.max(Number(job.total_price || 0) - Number(job.deposit || 0), 0);
  const lines = [...jobCopyHeader(job), `Tổng tiền: ${money(job.total_price)} | Đã cọc: ${money(job.deposit)} | Còn nợ: ${money(debt)}`];
  if (job.note) lines.push(`📝 Ghi chú Job: ${job.note}`);
  [...(job.job_days || [])].sort((a, b) => clean(a.shooting_date).localeCompare(clean(b.shooting_date)))
    .forEach((day, index) => lines.push(...jobCopyDay(job, day, index)));
  return lines.join("\n");
}

export async function copyJobText(text: string, successMessage: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    alert(successMessage);
  } catch {
    alert("Không sao chép được. Anh/chị hãy cho phép trình duyệt truy cập bộ nhớ tạm rồi thử lại.");
  }
}
