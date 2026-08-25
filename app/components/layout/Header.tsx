"use client";
import { Bell,LogOut,Menu,Search,UserCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { clearSession,type AppUser } from "@/lib/auth";
import { useBranding } from "../useBranding";
export default function Header({user,onMenuClick}:{user:AppUser;onMenuClick?:()=>void}){
 const router=useRouter(); const brand=useBranding();
 function logout(){clearSession();router.replace("/login")}
 return <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-white px-4 text-slate-900 sm:px-6 lg:px-8">
   <div className="flex min-w-0 items-center gap-3 text-gray-500"><button onClick={onMenuClick} aria-label="Mở menu" className="rounded-lg border p-2 text-slate-700 lg:hidden"><Menu size={20}/></button><Search size={20} className="hidden sm:block"/><span className="hidden truncate text-sm sm:block">Tìm kiếm nhanh trong hệ thống...</span></div>
   <div className="flex items-center gap-3 sm:gap-5"><Bell className="text-gray-500" size={20}/><div className="flex items-center gap-2">{brand.avatar?<img src={brand.avatar} alt="Ảnh đại diện" className="h-8 w-8 rounded-full object-cover ring-1 ring-slate-200"/>:<UserCircle2 size={32}/>}<div className="hidden sm:block"><p className="font-semibold leading-tight">{user.full_name}</p><p className="text-xs text-gray-500">{user.role_label}</p></div></div><button onClick={logout} className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-50" title="Đăng xuất"><LogOut size={16} className="sm:hidden"/><span className="hidden sm:inline">Đăng xuất</span></button></div>
 </header>
}
