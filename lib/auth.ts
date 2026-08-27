export type AppRole =
  | "admin"
  | "coordinator"
  | "photographer"
  | "videographer"
  | "editor"
  | "accountant"
  | "viewer";

export type AppUser = {
  id: string;
  full_name: string;
  username: string;
  role: AppRole;
  role_label: string;
  phone?: string;
};

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin",
  coordinator: "Điều phối / Sale",
  photographer: "Photographer",
  videographer: "Videographer",
  editor: "Editor",
  accountant: "Kế toán",
  viewer: "Chỉ xem",
};

export const ROLE_OPTIONS: { value: AppRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "coordinator", label: "Điều phối / Sale" },
  { value: "photographer", label: "Photographer" },
  { value: "videographer", label: "Videographer" },
  { value: "editor", label: "Editor" },
  { value: "accountant", label: "Kế toán" },
  { value: "viewer", label: "Chỉ xem" },
];

export const ROLE_PERMISSIONS: Record<AppRole, string[]> = {
  admin: ["dashboard", "customers", "schedule", "job", "employees", "reserve", "payments", "cashflow", "salary", "drive", "reports", "chat", "profile", "ai", "settings"],
  coordinator: ["dashboard", "schedule", "job", "salary", "chat", "profile"],
  photographer: ["dashboard", "schedule", "job", "salary", "chat", "profile"],
  videographer: ["dashboard", "schedule", "job", "salary", "chat", "profile"],
  editor: ["dashboard", "schedule", "job", "salary", "chat", "profile"],
  accountant: ["dashboard", "schedule", "job", "salary", "chat", "profile"],
  viewer: ["dashboard", "schedule", "job", "salary", "chat", "profile"],
};

export function normalizeRole(role: string | null | undefined): AppRole {
  const value = String(role || "viewer").toLowerCase().trim();
  if (["admin", "quản trị", "quan tri", "quản trị viên", "quan tri vien"].includes(value)) return "admin";
  if (["coordinator", "sale", "điều phối", "dieu phoi", "sale / điều phối", "sale / dieu phoi"].includes(value)) return "coordinator";
  if (["photographer", "thợ chụp", "tho chup", "chụp", "chup"].includes(value)) return "photographer";
  if (["videographer", "thợ quay", "tho quay", "quay", "quay phim", "flycam"].includes(value)) return "videographer";
  if (["editor", "dựng", "dung", "hậu kỳ", "hau ky", "thiết kế", "thiet ke"].includes(value)) return "editor";
  if (["accountant", "kế toán", "ke toan", "ketoan"].includes(value)) return "accountant";
  return "viewer";
}

export function canAccess(role: AppRole | string | null | undefined, permission: string) {
  const normalized = normalizeRole(String(role || "viewer"));
  return ROLE_PERMISSIONS[normalized].includes(permission);
}

export function permissionFromPath(pathname: string) {
  if (pathname === "/") return "dashboard";
  if (pathname.startsWith("/customers")) return "customers";
  if (pathname.startsWith("/schedule")) return "schedule";
  if (pathname.startsWith("/job")) return "job";
  if (pathname.startsWith("/employees")) return "employees";
  if (pathname.startsWith("/reserve")) return "reserve";
  if (pathname.startsWith("/payments")) return "payments";
  if (pathname.startsWith("/cashflow")) return "cashflow";
  if (pathname.startsWith("/salary")) return "salary";
  if (pathname.startsWith("/drive")) return "drive";
  if (pathname.startsWith("/reports")) return "reports";
  if (pathname.startsWith("/chat")) return "chat";
  if (pathname.startsWith("/profile")) return "profile";
  if (pathname.startsWith("/ai")) return "ai";
  if (pathname.startsWith("/settings")) return "settings";
  return "dashboard";
}

export function saveSession(user: AppUser) {
  if (typeof window === "undefined") return;
  localStorage.setItem("been_media_user", JSON.stringify(user));
}

export function getSession(): AppUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("been_media_user");
  if (!raw) return null;
  try {
    const user = JSON.parse(raw);
    return { ...user, role: normalizeRole(user.role) };
  } catch {
    return null;
  }
}

export function clearSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("been_media_user");
}
