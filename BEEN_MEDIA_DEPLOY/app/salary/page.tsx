"use client";
import { useEffect, useState } from "react";
import { getSession, type AppUser } from "@/lib/auth";
import AdminSalaryPage from "./AdminSalaryPage";
import WorkerSalaryPage from "./WorkerSalaryPage";
export default function SalaryPage(){ const [user,setUser]=useState<AppUser|null>(null); useEffect(()=>setUser(getSession()),[]); if(!user)return null; return user.role==="admin"?<AdminSalaryPage/>:<WorkerSalaryPage user={user}/>; }
