"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";

interface Props {
  children: React.ReactNode;
}

export default function MainLayout({ children }: Props) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 lg:flex">
      <Sidebar open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

      {mobileMenuOpen && (
        <button
          aria-label="Đóng menu"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <div className="min-w-0 flex-1">
        <Header onMenuClick={() => setMobileMenuOpen(true)} />
        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
