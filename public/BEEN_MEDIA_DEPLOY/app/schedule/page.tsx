"use client";
import { useEffect, useState } from "react";
import { getSession, type AppUser } from "@/lib/auth";
import AdminSchedulePage from "./AdminSchedulePage";
import WorkerSchedulePage from "./WorkerSchedulePage";
export default function SchedulePage(){ const [user,setUser]=useState<AppUser|null>(null); useEffect(()=>setUser(getSession()),[]); if(!user)return null; return user.role==="admin"?<AdminSchedulePage/>:<WorkerSchedulePage user={user}/>; }
