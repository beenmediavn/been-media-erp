"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, Plus, Send, Trash2, Undo2, Users, X } from "lucide-react";
import MainLayout from "@/app/components/layout/MainLayout";
import { getSession, type AppUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { formatDateTimeVN } from "@/lib/date-vn";

type Room = { id:string; name:string|null; room_type:"private"|"group"; created_by:string; created_at:string; hidden_for?:string[]|null; deleted_at?:string|null; };
type Member = { user_id:string; display_name:string; role:string|null; };
type Msg = { id:string; room_id:string; sender_id:string; sender_name:string; content:string; created_at:string; recalled_at?:string|null; recalled_by?:string|null; hidden_for?:string[]|null; };

export default function ChatPage(){
  const [user,setUser]=useState<AppUser|null>(null);
  useEffect(()=>setUser(getSession()),[]);
  if(!user) return <MainLayout><div className="p-4">Đang tải...</div></MainLayout>;
  return <MainLayout><ChatApp user={user}/></MainLayout>;
}

function ChatApp({user}:{user:AppUser}){
  const [rooms,setRooms]=useState<Room[]>([]);
  const [selected,setSelected]=useState<Room|null>(null);
  const [messages,setMessages]=useState<Msg[]>([]);
  const [text,setText]=useState("");
  const [loading,setLoading]=useState(true);
  const [showNew,setShowNew]=useState(false);
  const [people,setPeople]=useState<Member[]>([]);
  const [picked,setPicked]=useState<string[]>([]);
  const [roomName,setRoomName]=useState("");
  const [mode,setMode]=useState<"private"|"group">("private");
  const bottomRef=useRef<HTMLDivElement|null>(null);

  async function loadRooms(){
    setLoading(true);
    const {data:members,error}=await supabase.from("chat_members").select("room_id").eq("user_id",user.id);
    if(error){ setLoading(false); return; }
    const ids=(members||[]).map((x:any)=>x.room_id);
    if(!ids.length){setRooms([]);setSelected(null);setLoading(false);return;}
    const {data}=await supabase.from("chat_rooms").select("*").in("id",ids).is("deleted_at",null).order("updated_at",{ascending:false});
    const list=((data||[]) as Room[]).filter(r=>!(r.hidden_for||[]).includes(user.id));
    setRooms(list);
    setSelected(s=>s && list.some(r=>r.id===s.id) ? s : list[0]||null);
    setLoading(false);
  }

  async function loadMessages(roomId:string){
    const {data}=await supabase.from("chat_messages").select("*").eq("room_id",roomId).order("created_at",{ascending:true}).limit(500);
    setMessages(((data||[]) as Msg[]).filter(m=>!(m.hidden_for||[]).includes(user.id)));
    setTimeout(()=>bottomRef.current?.scrollIntoView({behavior:"smooth"}),50);
  }

  useEffect(()=>{loadRooms()},[user.id]);
  useEffect(()=>{
    if(!selected){setMessages([]);return;}
    loadMessages(selected.id);
    const channel=supabase.channel(`chat:${selected.id}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"chat_messages",filter:`room_id=eq.${selected.id}`},(payload:any)=>{
        if(payload.eventType==="DELETE"){setMessages(prev=>prev.filter(x=>x.id!==payload.old.id));return;}
        const next=payload.new as Msg;
        if((next.hidden_for||[]).includes(user.id)){setMessages(prev=>prev.filter(x=>x.id!==next.id));return;}
        setMessages(prev=>prev.some(x=>x.id===next.id)?prev.map(x=>x.id===next.id?next:x):[...prev,next]);
        setTimeout(()=>bottomRef.current?.scrollIntoView({behavior:"smooth"}),40);
      }).subscribe();
    return()=>{supabase.removeChannel(channel)};
  },[selected?.id]);

  async function send(e:FormEvent){
    e.preventDefault();
    const content=text.trim();
    if(!selected||!content)return;
    setText("");
    const {error}=await supabase.from("chat_messages").insert([{
      room_id:selected.id,sender_id:user.id,sender_name:user.full_name,content
    }]);
    if(error){alert(error.message);setText(content);return;}
    await supabase.from("chat_rooms").update({updated_at:new Date().toISOString()}).eq("id",selected.id);
  }

  async function recallMessage(m:Msg){
    if(m.sender_id!==user.id)return;
    if(!confirm("Thu hồi tin nhắn này với mọi người?"))return;
    const {error}=await supabase.from("chat_messages").update({content:"",recalled_at:new Date().toISOString(),recalled_by:user.id}).eq("id",m.id).eq("sender_id",user.id);
    if(error)return alert(error.message);
    setMessages(prev=>prev.map(x=>x.id===m.id?{...x,content:"",recalled_at:new Date().toISOString(),recalled_by:user.id}:x));
  }

  async function deleteForMe(m:Msg){
    if(!confirm("Xóa tin nhắn này ở phía bạn?"))return;
    const hidden=Array.from(new Set([...(m.hidden_for||[]),user.id]));
    const {error}=await supabase.from("chat_messages").update({hidden_for:hidden}).eq("id",m.id);
    if(error)return alert(error.message);
    setMessages(prev=>prev.filter(x=>x.id!==m.id));
  }


  async function deleteConversation(){
    if(!selected)return;
    if(user.role==="admin"){
      if(!confirm(`Xóa toàn bộ ${selected.room_type==="group"?"nhóm chat":"cuộc trò chuyện"} “${selected.name||"Tin nhắn"}” với mọi người?\n\nDữ liệu sẽ được ẩn khỏi hệ thống nhưng vẫn còn trong nhật ký để tránh xóa nhầm.`))return;
      const now=new Date().toISOString();
      const {error}=await supabase.from("chat_rooms").update({deleted_at:now,deleted_by:user.id}).eq("id",selected.id);
      if(error)return alert(error.message);
      await supabase.from("chat_messages").update({content:"",recalled_at:now,recalled_by:user.id}).eq("room_id",selected.id).is("recalled_at",null);
      await supabase.from("audit_logs").insert([{actor_id:user.id,actor_name:user.full_name,action:"DELETE_CONVERSATION",entity_type:"chat_room",entity_id:selected.id,note:`Xóa toàn bộ ${selected.room_type==="group"?"nhóm":"chat riêng"}: ${selected.name||"Tin nhắn"}`}]);
      setSelected(null); setMessages([]); await loadRooms();
      return;
    }
    if(!confirm("Xóa cuộc trò chuyện này khỏi danh sách của bạn?"))return;
    const hidden=Array.from(new Set([...(selected.hidden_for||[]),user.id]));
    const {error}=await supabase.from("chat_rooms").update({hidden_for:hidden}).eq("id",selected.id);
    if(error)return alert(error.message);
    setSelected(null);setMessages([]);await loadRooms();
  }

  async function openNew(){
    const {data}=await supabase.from("employees").select("id,full_name,app_role,role").eq("active",true).order("full_name");
    const arr:Member[]=[{user_id:"admin",display_name:"Admin chính",role:"admin"},
      ...(data||[]).map((e:any)=>({user_id:e.id,display_name:e.full_name,role:e.app_role||e.role}))];
    const available=arr.filter(p=>p.user_id!==user.id);
    setPeople(user.role==="admin"?available:available.filter(p=>String(p.role||"").toLowerCase()==="admin"));
    setPicked([]); setRoomName(""); setMode("private"); setShowNew(true);
  }

  async function createRoom(){
    if(user.role!=="admin" && mode==="group"){alert("Chỉ Admin được tạo nhóm. Nhân sự vẫn nhắn được trong các nhóm đã được thêm vào.");return;}
    if(mode==="private" && picked.length!==1){alert("Chọn 1 người để chat riêng.");return;}
    if(mode==="group" && picked.length<1){alert("Chọn ít nhất 1 thành viên.");return;}
    const chosen=people.filter(p=>picked.includes(p.user_id));
    const name=mode==="group"?(roomName.trim()||`Nhóm ${chosen.map(x=>x.display_name).join(", ")}`):chosen[0]?.display_name||"Chat riêng";
    const {data:room,error}=await supabase.from("chat_rooms").insert([{
      name,room_type:mode,created_by:user.id,updated_at:new Date().toISOString()
    }]).select("*").single();
    if(error||!room){alert(error?.message||"Không tạo được phòng chat");return;}
    const members=[
      {room_id:room.id,user_id:user.id,display_name:user.full_name,role:user.role},
      ...chosen.map(p=>({room_id:room.id,user_id:p.user_id,display_name:p.display_name,role:p.role}))
    ];
    const {error:merr}=await supabase.from("chat_members").insert(members);
    if(merr){alert(merr.message);return;}
    setShowNew(false); await loadRooms(); setSelected(room as Room);
  }

  return <div className="mx-auto max-w-7xl">
    <div className="mb-4 flex items-center justify-between gap-3">
      <div><h1 className="text-2xl font-bold sm:text-3xl">Tin nhắn nội bộ</h1><p className="text-sm text-slate-500">Nhân sự chỉ chat riêng với Admin; chat nhóm do Admin tạo. Có thể xóa cả cuộc trò chuyện cá nhân/nhóm.</p></div>
      <button onClick={openNew} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white"><Plus size={18}/>Tạo chat</button>
    </div>

    <div className="grid min-h-[68vh] overflow-hidden rounded-3xl bg-white shadow lg:grid-cols-[320px_1fr]">
      <aside className={`${selected?"hidden lg:block":"block"} border-r`}>
        <div className="border-b p-4"><b>Cuộc trò chuyện</b></div>
        <div className="max-h-[68vh] overflow-y-auto">
          {loading?<p className="p-4 text-slate-500">Đang tải...</p>:rooms.map(r=><button key={r.id} onClick={()=>setSelected(r)} className={`w-full border-b p-4 text-left hover:bg-slate-50 ${selected?.id===r.id?"bg-blue-50":""}`}>
            <div className="flex items-center gap-3"><span className={`grid h-10 w-10 place-items-center rounded-full ${r.room_type==="group"?"bg-emerald-100 text-emerald-700":"bg-blue-100 text-blue-700"}`}>{r.room_type==="group"?<Users size={19}/>:<MessageCircle size={19}/>}</span><div className="min-w-0"><p className="truncate font-semibold">{r.name||"Tin nhắn"}</p><p className="text-xs text-slate-500">{r.room_type==="group"?"Nhóm":"Riêng tư"}</p></div></div>
          </button>)}
          {!loading&&!rooms.length&&<div className="p-6 text-center text-sm text-slate-500">Chưa có cuộc trò chuyện.</div>}
        </div>
      </aside>

      <section className={`${selected?"flex":"hidden lg:flex"} min-w-0 flex-col`}>
        {selected?<><div className="flex items-center justify-between gap-3 border-b p-4"><div className="flex items-center gap-3"><button onClick={()=>setSelected(null)} className="rounded-lg border px-3 py-2 lg:hidden">‹</button><div><b>{selected.name||"Tin nhắn"}</b><p className="text-xs text-slate-500">{selected.room_type==="group"?"Chat nhóm":"Chat riêng"}</p></div></div><button type="button" onClick={deleteConversation} className="flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50" title={user.role==="admin"?"Xóa toàn bộ cuộc trò chuyện":"Xóa cuộc trò chuyện khỏi phía tôi"}><Trash2 size={16}/><span className="hidden sm:inline">Xóa cuộc trò chuyện</span></button></div>
        <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4 sm:p-6">
          {messages.map(m=>{const mine=m.sender_id===user.id;return <div key={m.id} className={`flex ${mine?"justify-end":"justify-start"}`}><div className={`group max-w-[85%] rounded-2xl px-4 py-3 shadow-sm sm:max-w-[70%] ${mine?"bg-blue-600 text-white":"bg-white text-slate-900"}`}><p className={`mb-1 text-[11px] font-semibold ${mine?"text-blue-100":"text-slate-500"}`}>{mine?"Bạn":m.sender_name}</p>{m.recalled_at?<p className={`italic ${mine?"text-blue-100":"text-slate-400"}`}>Tin nhắn đã được thu hồi</p>:<p className="whitespace-pre-wrap break-words">{m.content}</p>}<div className="mt-1 flex items-center justify-between gap-3"><p className={`text-[10px] ${mine?"text-blue-100":"text-slate-400"}`}>{formatDateTimeVN(m.created_at)}</p><div className={`flex gap-1 ${mine?"text-blue-100":"text-slate-400"}`}>{mine&&!m.recalled_at&&<button type="button" onClick={()=>recallMessage(m)} className="rounded p-1 hover:bg-black/10" title="Thu hồi"><Undo2 size={14}/></button>}<button type="button" onClick={()=>deleteForMe(m)} className="rounded p-1 hover:bg-black/10" title="Xóa phía tôi"><Trash2 size={14}/></button></div></div></div></div>})}
          <div ref={bottomRef}/>
        </div>
        <form onSubmit={send} className="flex gap-2 border-t bg-white p-3 sm:p-4"><input value={text} onChange={e=>setText(e.target.value)} placeholder="Nhập tin nhắn..." className="min-w-0 flex-1 rounded-xl border px-4 py-3"/><button className="grid h-12 w-12 place-items-center rounded-xl bg-blue-600 text-white"><Send size={20}/></button></form></>:<div className="grid flex-1 place-items-center text-center text-slate-400"><div><MessageCircle className="mx-auto mb-2" size={48}/><p>Chọn cuộc trò chuyện hoặc tạo chat mới.</p></div></div>}
      </section>
    </div>

    {showNew&&<div className="fixed inset-0 z-[100] grid place-items-center bg-black/50 p-3"><div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl">
      <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-bold">Tạo cuộc trò chuyện</h2><button onClick={()=>setShowNew(false)}><X/></button></div>
      <div className={`mb-4 grid gap-2 ${user.role==="admin"?"grid-cols-2":"grid-cols-1"}`}><button onClick={()=>{setMode("private");setPicked([])}} className={`rounded-xl border p-3 font-semibold ${mode==="private"?"bg-blue-600 text-white":""}`}>Chat riêng với Admin</button>{user.role==="admin"&&<button onClick={()=>{setMode("group");setPicked([])}} className={`rounded-xl border p-3 font-semibold ${mode==="group"?"bg-blue-600 text-white":""}`}>Chat nhóm</button>}</div>
      {mode==="group"&&<input value={roomName} onChange={e=>setRoomName(e.target.value)} placeholder="Tên nhóm (không bắt buộc)" className="mb-3 w-full rounded-xl border p-3"/>}
      <div className="max-h-72 space-y-2 overflow-y-auto rounded-2xl border p-2">
        {people.map(p=>{const on=picked.includes(p.user_id);return <button key={p.user_id} onClick={()=>setPicked(prev=>mode==="private"?(on?[]:[p.user_id]):on?prev.filter(x=>x!==p.user_id):[...prev,p.user_id])} className={`flex w-full items-center justify-between rounded-xl p-3 text-left ${on?"bg-blue-50 ring-1 ring-blue-200":"hover:bg-slate-50"}`}><div><b>{p.display_name}</b><p className="text-xs text-slate-500">{p.role||"Nhân sự"}</p></div><span className={`h-5 w-5 rounded-full border ${on?"border-blue-600 bg-blue-600":""}`}/></button>})}
      </div>
      <button onClick={createRoom} className="mt-4 w-full rounded-xl bg-blue-600 p-3 font-bold text-white">Tạo cuộc trò chuyện</button>
    </div></div>}
  </div>
}
