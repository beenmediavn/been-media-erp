"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays,BriefcaseBusiness,House,MessagesSquare,Banknote } from "lucide-react";
import { canAccess,type AppUser } from "@/lib/auth";

const items=[
 {href:"/schedule",label:"Lịch",icon:CalendarDays,permission:"schedule"},
 {href:"/job",label:"Job",icon:BriefcaseBusiness,permission:"job"},
 {href:"/",label:"Tổng quát",icon:House,permission:"dashboard",primary:true},
 {href:"/chat",label:"Chat",icon:MessagesSquare,permission:"chat"},
 {href:"/salary",label:"Lương",icon:Banknote,permission:"salary"},
];

export default function MobileBottomNav({user}:{user:AppUser}){
  const pathname=usePathname();
  const visible=items.filter(i=>canAccess(user.role,i.permission));
  return <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-white px-2 pb-[max(.45rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-6px_20px_rgba(15,23,42,.08)] lg:hidden">
    <div className="mx-auto flex max-w-lg items-end justify-around gap-1">
      {visible.map(item=>{
        const I=item.icon;
        const active=item.href==="/"?pathname==="/":pathname.startsWith(item.href);
        return <Link key={item.href} href={item.href} className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold">
          <span className={`grid h-10 w-10 place-items-center rounded-full ${item.primary?"-mt-6 h-14 w-14 border-4 border-white bg-blue-600 text-white shadow-lg":active?"bg-blue-50 text-blue-600":"text-slate-500"}`}><I size={item.primary?27:21}/></span>
          <span className={`max-w-full truncate ${active?"text-blue-600":"text-slate-500"}`}>{item.label}</span>
        </Link>
      })}
    </div>
  </nav>
}
