"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSession, type AppUser } from "@/lib/auth";
import AdminDashboard from "./AdminDashboard";
import WorkerDashboard from "./WorkerDashboard";

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<AppUser | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    setUser(session);
    setChecking(false);
  }, [router]);

  if (checking || !user) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="rounded-2xl bg-white px-6 py-5 shadow-sm text-center">
          <div className="text-xl font-bold text-blue-600">BEEN MEDIA</div>
          <div className="mt-2 text-sm text-slate-500">Đang mở ứng dụng...</div>
        </div>
      </main>
    );
  }

  return user.role === "admin" ? <AdminDashboard /> : <WorkerDashboard user={user} />;
}
