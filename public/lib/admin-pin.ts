import { supabase } from "@/lib/supabase";

export async function requireEditPin(action="thao tác này"){
  const {data}=await supabase.from("app_settings").select("value").eq("id","edit_pin").maybeSingle();
  const pin=data?.value||"2580";
  const entered=window.prompt(`Nhập mật khẩu sửa/xóa để ${action}:`);
  if(entered===null)return false;
  if(entered!==pin){alert("Mật khẩu sửa/xóa không đúng");return false;}
  return true;
}
