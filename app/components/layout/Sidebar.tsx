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

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-72 bg-slate-950 text-white min-h-screen p-6 sticky top-0">
      <Link href="/" className="block">
        <h1 className="text-2xl font-bold text-blue-400">BEEN MEDIA</h1>
        <p className="text-gray-400 text-sm mb-10">ERP Management</p>
      </Link>

      <nav className="space-y-2">
        {menus.map((item) => {
          const Icon = item.icon;
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 w-full rounded-xl p-3 transition ${
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
