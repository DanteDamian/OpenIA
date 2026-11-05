import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./config";
export function validAdminKey(key: string | undefined) {
  if (!key) return false;
  if (/^sb_secret_[a-zA-Z0-9_-]{16,}$/.test(key)) return true;
  try { return JSON.parse(Buffer.from(key.split(".")[1],"base64url").toString()).role === "service_role" && key.split(".").length === 3; } catch {return false;}
}
export function adminConfiguration() {
  const config=getSupabaseConfig();
  const key=process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  return config && validAdminKey(key) ? {...config,key:key!} : null;
}
export function createSupabaseAdminClient() {
  const config=adminConfiguration();
  if (!config) return null;
  return createClient(config.url,config.key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}
