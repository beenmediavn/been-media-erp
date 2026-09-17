"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import Header from "./Header";
import MobileBottomNav from "./MobileBottomNav";
import { canAccess, getSession, permissionFromPath, type AppUser } from "@/lib/auth";

interface Props {
  children: React.ReactNode;
}

export default function MainLayout({ children }: Props) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<AppUser | null>(null);
  const [checked, setChecked] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    setUser(session);
    setChecked(true);
  }, [router]);

  if (!checked || !user) {
    return <div className="been-shell min-h-screen flex items-center justify-center text-slate-600">Đang kiểm tra đăng nhập...</div>;
  }

  const permission = permissionFromPath(pathname);
  const allowed = canAccess(user.role, permission);

  return (
    <div className="been-shell min-h-screen text-slate-900 lg:flex">
      <Sidebar user={user} open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

      {mobileMenuOpen && (
        <button
          aria-label="Đóng menu"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <div className="min-w-0 flex-1">
        <Header user={user} onMenuClick={() => setMobileMenuOpen(true)} />
        <main className="p-4 pb-24 sm:p-6 sm:pb-24 lg:p-8">
          {allowed ? (
            children
          ) : (
            <div className="rounded-2xl bg-white p-8 shadow">
              <h1 className="text-2xl font-bold text-red-600">Không có quyền truy cập</h1>
              <p className="mt-2 text-slate-600">Tài khoản của bạn không được phép xem mục này. Vui lòng liên hệ Admin BEEN MEDIA.</p>
            </div>
          )}
        </main>
        <MobileBottomNav user={user} />
      </div>
    </div>
  );
}
