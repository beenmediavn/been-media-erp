"use client";
import { useEffect, useState } from "react";
import { getSession, type AppUser } from "@/lib/auth";
import AdminDashboard from "./AdminDashboard";
import WorkerDashboard from "./WorkerDashboard";
export default function Home(){ const [user,setUser]=useState<AppUser|null>(null); useEffect(()=>setUser(getSession()),[]); if(!user)return null; return user.role==="admin"?<AdminDashboard/>:<WorkerDashboard user={user}/>; }
