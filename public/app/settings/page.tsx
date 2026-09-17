"use client";
import { useEffect,useState } from "react";
import MainLayout from "../components/layout/MainLayout";
import { supabase } from "@/lib/supabase";
import { Camera,Image as ImageIcon,ShieldCheck,Sparkles,WifiOff } from "lucide-react";

async function fileToDataUrl(file:File,max=640){return await new Promise<string>((resolve,reject)=>{const img=new Image();const reader=new FileReader();reader.onload=()=>{img.onload=()=>{const scale=Math.min(1,max/Math.max(img.width,img.height));const c=document.createElement('canvas');c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);const ctx=c.getContext('2d');ctx?.drawImage(img,0,0,c.width,c.height);resolve(c.toDataURL('image/jpeg',.86))};img.onerror=reject;img.src=String(reader.result)};reader.onerror=reject;reader.readAsDataURL(file)})}

export default function SettingsPage(){
 const [pin,setPin]=useState("2580"),[logo,setLogo]=useState(""),[avatar,setAvatar]=useState(""),[companyName,setCompanyName]=useState("BEEN MEDIA"),[saving,setSaving]=useState(false);
 const [currentAdminPassword,setCurrentAdminPassword]=useState("");
 const [newAdminPassword,setNewAdminPassword]=useState("");
 const [confirmAdminPassword,setConfirmAdminPassword]=useState("");
 useEffect(()=>{supabase.from("app_settings").select("id,value").in("id",["edit_pin","brand_logo","admin_avatar","company_name"]).then(({data})=>{const m=Object.fromEntries((data||[]).map((x:any)=>[x.id,x.value||""]));if(m.edit_pin)setPin(m.edit_pin);if(m.brand_logo)setLogo(m.brand_logo);if(m.admin_avatar)setAvatar(m.admin_avatar);if(m.company_name)setCompanyName(m.company_name)})},[]);
 async function saveSetting(id:string,value:string,note:string){const {error}=await supabase.from("app_settings").upsert({id,value,note,updated_at:new Date().toISOString()});if(error)throw error;window.dispatchEvent(new Event("been-brand-updated"))}
 async function savePin(){if(!/^\d{4,6}$/.test(pin))return alert("PIN phải gồm 4–6 số");setSaving(true);try{await saveSetting("edit_pin",pin,"PIN xác nhận thao tác sửa/xóa quan trọng");alert("Đã cập nhật PIN")}catch(e:any){alert(e.message)}finally{setSaving(false)}}
 async function saveAdminPassword(){
   if(!currentAdminPassword || !newAdminPassword || !confirmAdminPassword) return alert("Vui lòng nhập đủ 3 ô mật khẩu.");
   if(newAdminPassword.length < 6) return alert("Mật khẩu mới phải có ít nhất 6 ký tự.");
   if(newAdminPassword !== confirmAdminPassword) return alert("Hai lần nhập mật khẩu mới không khớp.");

   setSaving(true);
   try{
     const {data,error}=await supabase.from("app_settings").select("value").eq("id","admin_password").maybeSingle();
     if(error) throw error;
     const currentStored=data?.value || "181096";
     if(currentAdminPassword !== currentStored) return alert("Mật khẩu Admin hiện tại không đúng.");
     await saveSetting("admin_password",newAdminPassword,"Mật khẩu đăng nhập Admin chính");
     setCurrentAdminPassword("");setNewAdminPassword("");setConfirmAdminPassword("");
     alert("Đã đổi mật khẩu Admin. Từ lần đăng nhập sau dùng mật khẩu mới.");
   }catch(e:any){alert(e.message)}
   finally{setSaving(false)}
 }
 async function saveBrand(){setSaving(true);try{await saveSetting("company_name",companyName||"BEEN MEDIA","Tên thương hiệu hiển thị");await saveSetting("brand_logo",logo,"Logo hiển thị app");await saveSetting("admin_avatar",avatar,"Ảnh đại diện Admin");alert("Đã cập nhật nhận diện")}catch(e:any){alert(e.message)}finally{setSaving(false)}}
 async function choose(e:React.ChangeEvent<HTMLInputElement>,setter:(v:string)=>void,max=640){const f=e.target.files?.[0];if(!f)return;if(f.size>8*1024*1024)return alert("Ảnh tối đa 8MB");try{setter(await fileToDataUrl(f,max))}catch{alert("Không đọc được ảnh")}}
 return <MainLayout><div className="mx-auto max-w-5xl"><div className="mb-6"><h1 className="text-3xl font-bold bm-gold">Cài đặt</h1><p className="bm-muted">Cấu hình hệ thống, nhận diện và bảo mật BEEN MEDIA ERP.</p></div>
  <div className="space-y-4">
   <section className="bm-card rounded-3xl p-5 sm:p-6"><div className="mb-4 flex items-center gap-2"><ImageIcon className="bm-gold"/><div><h2 className="text-lg font-bold">Thương hiệu & tài khoản</h2><p className="text-sm bm-muted">Logo và ảnh đại diện có thể thay ngay trong app, không cần sửa code.</p></div></div><div className="grid gap-5 sm:grid-cols-2"><div><label className="text-sm font-semibold">Logo BEEN MEDIA</label><div className="mt-2 flex items-center gap-4">{logo?<img src={logo} className="h-24 w-24 rounded-2xl bg-white/5 object-contain p-2 ring-1 ring-slate-200"/>:<div className="grid h-24 w-24 place-items-center rounded-2xl border border-dashed border-slate-300 bm-muted">Chưa có</div>}<label className="cursor-pointer rounded-xl border border-slate-300 px-4 py-2 font-semibold bm-gold">Thay logo<input type="file" accept="image/*" className="hidden" onChange={e=>choose(e,setLogo,800)}/></label></div></div><div><label className="text-sm font-semibold">Ảnh đại diện Admin</label><div className="mt-2 flex items-center gap-4">{avatar?<img src={avatar} className="h-24 w-24 rounded-full object-cover ring-2 ring-slate-200"/>:<div className="grid h-24 w-24 place-items-center rounded-full border border-dashed border-slate-300"><Camera className="bm-gold"/></div>}<label className="cursor-pointer rounded-xl border border-slate-300 px-4 py-2 font-semibold bm-gold">Thay ảnh<input type="file" accept="image/*" capture="user" className="hidden" onChange={e=>choose(e,setAvatar,512)}/></label></div></div><label className="sm:col-span-2 text-sm font-semibold">Tên thương hiệu<input value={companyName} onChange={e=>setCompanyName(e.target.value)} className="mt-1 w-full rounded-xl border p-3" placeholder="BEEN MEDIA"/></label></div><button onClick={saveBrand} disabled={saving} className="mt-5 rounded-xl bg-blue-600 px-5 py-3 font-bold text-white">{saving?"Đang lưu...":"Lưu nhận diện"}</button></section>
   <section className="bm-card rounded-3xl p-5 sm:p-6"><div className="flex items-start gap-3"><ShieldCheck className="bm-gold"/><div className="flex-1"><h2 className="font-bold">Mật khẩu Admin chính</h2><p className="mb-3 text-sm bm-muted">Tài khoản đăng nhập là <b>admin</b>. Có thể đổi mật khẩu tại đây bất cứ lúc nào.</p><div className="grid gap-3 sm:grid-cols-3"><label className="text-sm font-medium">Mật khẩu hiện tại<input type="password" autoComplete="current-password" value={currentAdminPassword} onChange={e=>setCurrentAdminPassword(e.target.value)} className="mt-1 w-full rounded-xl border p-3"/></label><label className="text-sm font-medium">Mật khẩu mới<input type="password" autoComplete="new-password" value={newAdminPassword} onChange={e=>setNewAdminPassword(e.target.value)} className="mt-1 w-full rounded-xl border p-3"/></label><label className="text-sm font-medium">Nhập lại mật khẩu mới<input type="password" autoComplete="new-password" value={confirmAdminPassword} onChange={e=>setConfirmAdminPassword(e.target.value)} className="mt-1 w-full rounded-xl border p-3"/></label></div><button onClick={saveAdminPassword} disabled={saving} className="mt-3 rounded-xl bg-blue-600 px-4 py-2 font-bold text-white">Đổi mật khẩu Admin</button></div></div></section>
   <section className="bm-card rounded-3xl p-5 sm:p-6"><div className="flex items-start gap-3"><ShieldCheck className="bm-gold"/><div className="flex-1"><h2 className="font-bold">Bảo vệ thao tác quan trọng</h2><p className="mb-3 text-sm bm-muted">PIN được hỏi khi sửa/xóa Job, khoản thu và giao dịch lương để tránh chạm nhầm trên điện thoại.</p><label className="block max-w-xs text-sm font-medium">PIN 4–6 số<input value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,"").slice(0,6))} inputMode="numeric" className="mt-1 w-full rounded-xl border p-3"/></label><button onClick={savePin} disabled={saving} className="mt-3 rounded-xl bg-blue-600 px-4 py-2 font-bold text-white">Lưu PIN</button></div></div></section>
   <section className="grid gap-4 sm:grid-cols-2"><div className="bm-card rounded-3xl p-5"><WifiOff className="mb-2 bm-gold"/><b>Offline / PWA</b><p className="mt-1 text-sm bm-muted">Có thể cài app lên màn hình chính. Khi mất mạng, Job/khách hàng được lưu vào IndexedDB; khi có mạng app tự đồng bộ lên Supabase. Biểu tượng mạng hiển thị ping, tốc độ ước tính và số dữ liệu đang chờ sync.</p></div><div className="bm-card rounded-3xl p-5"><Sparkles className="mb-2 bm-gold"/><b>AI (tùy chọn)</b><p className="mt-1 text-sm bm-muted">AI đang tạm ẩn để ưu tiên vận hành ERP ổn định. Khi cần, chỉ việc bật lại biến ENABLE_AI/NEXT_PUBLIC_ENABLE_AI và cấu hình API; không phải làm lại app.</p></div></section>
  </div>
 </div></MainLayout>
}
