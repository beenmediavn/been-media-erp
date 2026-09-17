"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type Branding = { logo:string; avatar:string; companyName:string };
const defaults:Branding={logo:"",avatar:"",companyName:"BEEN MEDIA"};

export function useBranding(){
  const [brand,setBrand]=useState<Branding>(defaults);
  async function load(){
    try{
      const {data}=await supabase.from("app_settings").select("id,value").in("id",["brand_logo","admin_avatar","company_name"]);
      const map=Object.fromEntries((data||[]).map((x:any)=>[x.id,x.value||""]));
      setBrand({logo:map.brand_logo||"",avatar:map.admin_avatar||"",companyName:map.company_name||"BEEN MEDIA"});
    }catch{}
  }
  useEffect(()=>{load(); const fn=()=>load(); window.addEventListener("been-brand-updated",fn); return()=>window.removeEventListener("been-brand-updated",fn)},[]);
  return brand;
}
