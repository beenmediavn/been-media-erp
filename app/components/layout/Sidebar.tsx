"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Calendar,
  Camera,
  Wallet,
  Banknote,
  FolderOpen,
  BarChart3,
  Settings,
  UserCog,
  X,
} from "lucide-react";

const menus = [
  { name: "Dashboard", icon: LayoutDashboard, href: "/" },
  { name: "Khách hàng", icon: Users, href: "/customers" },
  { name: "Lịch chụp", icon: Calendar, href: "/schedule" },
  { name: "Job", icon: Camera, href: "/job" },
  { name: "Nhân sự", icon: UserCog, href: "/employees" },
  { name: "Thanh toán", icon: Wallet, href: "/payments" },
  { name: "Lương", icon: Banknote, href: "/salary" },
  { name: "Google Drive", icon: FolderOpen, href: "/drive" },
  { name: "Báo cáo", icon: BarChart3, href: "/reports" },
  { name: "Cài đặt", icon: Settings, href: "/settings" },
];

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ open = false, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[82vw] bg-slate-950 text-white p-5 transition-transform duration-300 lg:sticky lg:top-0 lg:z-auto lg:min-h-screen lg:translate-x-0 lg:p-6 ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="mb-8 flex items-start justify-between gap-4">
        <Link href="/" className="block" onClick={onClose}>
          <h1 className="text-2xl font-bold text-blue-400">BEEN MEDIA</h1>
          <p className="text-sm text-gray-400">ERP Management</p>
        </Link>

        <button
          type="button"
          aria-label="Đóng menu"
          onClick={onClose}
          className="rounded-lg p-2 text-slate-300 hover:bg-slate-800 lg:hidden"
        >
          <X size={22} />
        </button>
      </div>

      <nav className="space-y-2">
        {menus.map((item) => {
          const Icon = item.icon;
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onClose}
              className={`flex w-full items-center gap-3 rounded-xl p-3 transition ${
                active ? "bg-blue-600 text-white shadow" : "text-slate-200 hover:bg-slate-800"
              }`}
            >
              <Icon size={20} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
