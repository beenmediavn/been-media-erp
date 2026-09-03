"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard,Users,Calendar,Camera,Wallet,Banknote,FolderOpen,BarChart3,Settings,UserCog,ShieldCheck,X,Aperture,Sparkles,MessagesSquare,UserCircle2, ScrollText, ScanFace } from "lucide-react";
import { canAccess, type AppUser } from "@/lib/auth";
import { useBranding } from "../useBranding";

const menus=[
{key:"dashboard",name:"TỔNG QUÁT",icon:LayoutDashboard,href:"/"},
{key:"customers",name:"Khách hàng",icon:Users,href:"/customers"},
{key:"schedule",name:"Lịch chụp",icon:Calendar,href:"/schedule"},
{key:"job",name:"Job",icon:Camera,href:"/job"},
{key:"employees",name:"Nhân sự",icon:UserCog,href:"/employees"},
{key:"attendance",name:"CHẤM CÔNG",icon:ScanFace,href:"/attendance"},
{key:"reserve",name:"Thợ dự phòng",icon:ShieldCheck,href:"/reserve"},
{key:"payments",name:"Công nợ khách",icon:Wallet,href:"/payments"},
{key:"cashflow",name:"Thu / Chi",icon:Banknote,href:"/cashflow"},
{key:"salary",name:"Lương",icon:Banknote,href:"/salary"},
{key:"drive",name:"SẢN PHẨM",icon:FolderOpen,href:"/drive"},
{key:"reports",name:"Báo cáo",icon:BarChart3,href:"/reports"},
{key:"audit",name:"NHẬT KÝ HỆ THỐNG",icon:ScrollText,href:"/audit"},
{key:"chat",name:"Tin nhắn",icon:MessagesSquare,href:"/chat"},
{key:"profile",name:"Hồ sơ cá nhân",icon:UserCircle2,href:"/profile"},
{key:"ai",name:"AI Trợ lý",icon:Sparkles,href:"/ai"},
{key:"settings",name:"Cài đặt",icon:Settings,href:"/settings"},
];
export default function Sidebar({user,open=false,onClose}:{user:AppUser;open?:boolean;onClose?:()=>void}){
 const pathname=usePathname(); const aiEnabled=process.env.NEXT_PUBLIC_ENABLE_AI==="true"; const visible=menus.filter(i=>canAccess(user.role,i.key) && (i.key!=="ai" || aiEnabled)); const brand=useBranding(); const worker=user.role!=="admin";
 return <aside className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[82vw] bg-slate-950 p-5 text-white transition-transform duration-300 lg:sticky lg:top-0 lg:z-auto lg:min-h-screen lg:translate-x-0 lg:p-6 ${open?"translate-x-0":"-translate-x-full"}`}>
  <div className="mb-8 flex items-start justify-between gap-4"><Link href="/" className="flex min-w-0 items-center" onClick={onClose}>{brand.logo?<img src={brand.logo} alt="Logo BEEN MEDIA" className="h-14 w-14 rounded-xl object-contain"/>:<span className="grid h-14 w-14 place-items-center rounded-xl bg-slate-900 text-blue-400"><Aperture size={30}/></span>}</Link><button aria-label="Đóng menu" onClick={onClose} className="rounded-lg p-2 text-slate-300 hover:bg-slate-800 lg:hidden"><X size={22}/></button></div>
  <nav className="space-y-2">{visible.map(item=>{const I=item.icon;const active=item.href==="/"?pathname==="/":pathname.startsWith(item.href);return <Link key={item.name} href={item.href} onClick={onClose} className={`flex w-full items-center gap-3 rounded-xl p-3 transition ${active?"bg-blue-600 text-white shadow":"text-slate-200 hover:bg-slate-800"}`}><I size={20}/><span>{worker&&item.key==="job"?"Việc của tôi":worker&&item.key==="salary"?"Lương của tôi":item.name}</span></Link>})}</nav>
  <div className="mt-8 border-t border-slate-800 pt-3 text-[10px] text-slate-500">V8.3.7 • DỰ PHÒNG TẤT CẢ NGÀY + LỌC CHI TIẾT</div>
 </aside>
}
