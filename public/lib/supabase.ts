import { createClient } from "@supabase/supabase-js";

const FALLBACK_SUPABASE_URL = "https://udhgeadzstdjswdyplur.supabase.co";
const FALLBACK_SUPABASE_ANON_KEY =
  "sb_publishable_FoaxaxbHdSCVE7D188LBrQ_KYk6Bwdg";

const cleanUrl = (value?: string) => {
  const raw = (value || "").trim().replace(/\/+$/, "");

  // Bản deploy cũ từng bị nhập thừa 1 chữ y: jswdyyplur.
  // Dòng này tự sửa để app không còn lỗi ERR_NAME_NOT_RESOLVED dù Vercel còn cache env cũ.
  const normalized = raw.replace("udhgeadzstdjswdyyplur", "udhgeadzstdjswdyplur");

  if (!normalized || normalized.includes("AbcDe") || !normalized.includes("supabase.co")) {
    return FALLBACK_SUPABASE_URL;
  }

  return normalized;
};

const cleanKey = (value?: string) => {
  const raw = (value || "").trim();
  if (!raw || raw === "eyJ...." || raw === "..." || raw === "none") {
    return FALLBACK_SUPABASE_ANON_KEY;
  }
  return raw;
};

const supabaseUrl = cleanUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseKey = cleanKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
