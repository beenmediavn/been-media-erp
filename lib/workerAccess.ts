import type { AppUser } from "./auth";

export const isAdminUser = (user: AppUser | null | undefined) => user?.role === "admin";
export function contactIsVisible(assignment: any, shootingDate?: string, startTime?: string) {
  if (assignment?.contact_visible === true) return true;
  if (!shootingDate) return false;
  const start = new Date(`${shootingDate}T${startTime || "00:00"}:00`);
  if (Number.isNaN(start.getTime())) return false;
  return start.getTime() - Date.now() <= 48 * 60 * 60 * 1000;
}
export function workerStatus(shootingDate?: string, jobStatus?: string) {
  const today = new Date(); today.setHours(0,0,0,0);
  if (String(jobStatus || "").toLowerCase().includes("hoàn thành")) return "Đã hoàn thành";
  if (!shootingDate) return "Chưa hoàn thành";
  const d = new Date(`${shootingDate}T00:00:00`);
  return d < today ? "Đã làm - chờ hoàn thành" : "Sắp tới";
}
export function formatVNDate(value?: string) {
  if (!value) return ""; const [y,m,d] = value.split("-"); return y&&m&&d ? `${d}/${m}/${y}` : value;
}
