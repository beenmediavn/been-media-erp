"use client";
import { useEffect, useState } from "react";
import { getSession, type AppUser } from "@/lib/auth";
import AdminJobPage from "./AdminJobPage";
import WorkerJobPage from "./WorkerJobPage";
export default function JobPage(){ const [user,setUser]=useState<AppUser|null>(null); useEffect(()=>setUser(getSession()),[]); if(!user)return null; return user.role==="admin"?<AdminJobPage/>:<WorkerJobPage user={user}/>; }
