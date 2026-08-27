"use client";
import {useEffect,useState} from "react";
import MainLayout from "@/app/components/layout/MainLayout";
import {Camera,UserCircle2} from "lucide-react";
import {getSession,saveSession,type AppUser} from "@/lib/auth";
import {supabase} from "@/lib/supabase";

function resizeImage(file:File,max=600){return new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>{const img=new Image();img.onload=()=>{const ratio=Math.min(1,max/Math.max(img.width,img.height));const c=document.createElement("canvas");c.width=Math.max(1,Math.round(img.width*ratio));c.height=Math.max(1,Math.round(img.height*ratio));c.getContext("2d")!.drawImage(img,0,0,c.width,c.height);resolve(c.toDataURL("image/jpeg",.82))};img.onerror=reject;img.src=String(r.result)};r.onerror=reject;r.readAsDataURL(file)})}

export default function ProfilePage(){const [user,setUser]=useState<AppUser|null>(null),[avatar,setAvatar]=useState(""),[saving,setSaving]=useState(false);useEffect(()=>{const u=getSession();setUser(u);if(u&&u.role!=="admin")supabase.from("employees").select("avatar_url").eq("id",u.id).maybeSingle().then(({data})=>setAvatar(data?.avatar_url||""))},[]);if(!user)return <MainLayout><div>Đang tải...</div></MainLayout>;
 async function choose(file?:File){if(!file)return;setAvatar(await resizeImage(file))}
 async function save(){
  if(!user) return alert("Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.");
  if(user.role==="admin")return alert("Ảnh Admin đổi trong Cài đặt.");setSaving(true);const {error}=await supabase.from("employees").update({avatar_url:avatar}).eq("id",user.id);setSaving(false);if(error)return alert(error.message);saveSession(user);alert("Đã cập nhật ảnh đại diện")}
 return <MainLayout><div className="mx-auto max-w-xl"><h1 className="text-2xl font-bold sm:text-3xl">Hồ sơ cá nhân</h1><p className="mt-1 text-slate-500">Cập nhật ảnh đại diện để Admin dễ nhận đúng người khi phân công.</p><div className="mt-5 rounded-3xl bg-white p-6 shadow"><div className="flex flex-col items-center gap-4">{avatar?<img src={avatar} className="h-36 w-36 rounded-full object-cover ring-4 ring-slate-100"/>:<UserCircle2 className="h-36 w-36 text-slate-300"/>}<div className="text-center"><b className="text-xl">{user.full_name}</b><p className="text-sm text-slate-500">{user.role_label}</p></div>{user.role==="admin"?<p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Ảnh Admin cập nhật tại mục Cài đặt.</p>:<><label className="cursor-pointer rounded-xl border px-4 py-3 font-semibold text-blue-700"><Camera className="mr-2 inline" size={18}/>Chọn ảnh đại diện<input type="file" accept="image/*" capture="user" className="hidden" onChange={e=>choose(e.target.files?.[0])}/></label><button onClick={save} disabled={saving} className="w-full rounded-xl bg-blue-600 p-3 font-bold text-white">{saving?"Đang lưu...":"Lưu ảnh đại diện"}</button></>}</div></div></div></MainLayout>}
