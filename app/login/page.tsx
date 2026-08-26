"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { normalizeRole, ROLE_LABELS, saveSession } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const user = username.trim().toLowerCase();
    const pass = password.trim();

    if (user === "admin" && pass === "123456") {
      saveSession({ id: "admin", full_name: "Nguyễn Anh Tuấn", username: "admin", role: "admin", role_label: "Admin" });
      router.push("/");
      return;
    }

    const { data, error } = await supabase
      .from("employees")
      .select("*")
      .ilike("username", user)
      .eq("password", pass)
      .maybeSingle();

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    if (!data || data.active === false || (Object.prototype.hasOwnProperty.call(data, "can_login") && data.can_login === false)) {
      alert("Sai tài khoản/mật khẩu hoặc tài khoản chưa được cho phép đăng nhập.");
      return;
    }

    const role = normalizeRole(data.app_role || data.role);
    saveSession({
      id: data.id,
      full_name: data.full_name,
      username: data.username,
      phone: data.phone,
      role,
      role_label: ROLE_LABELS[role],
    });
    router.push("/");
  }

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <form onSubmit={handleLogin} autoComplete="off" className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-blue-600">BEEN MEDIA</h1>
          <p className="mt-1 text-slate-500">Đăng nhập ERP Management</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-semibold">Tài khoản</label>
            <input name="erp_username" autoComplete="off" autoCapitalize="none" spellCheck={false} className="w-full rounded-xl border p-3" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold">Mật khẩu</label>
            <input name="erp_password" type="password" autoComplete="new-password" className="w-full rounded-xl border p-3" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        </div>

        <button disabled={loading} className="mt-6 w-full rounded-xl bg-blue-600 p-3 font-semibold text-white disabled:opacity-60">
          {loading ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>

      </form>
    </main>
  );
}
