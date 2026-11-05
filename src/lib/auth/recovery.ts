import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { recoveryOrigin } from "./recovery-security";
export function recoveryConfiguration() {
  const supabase = getSupabaseConfig();
  const origin = recoveryOrigin(process.env);
  const secret = process.env.AUTH_RECOVERY_SECRET;
  if (!supabase || !origin || !secret || !/^[a-fA-F0-9]{64}$/.test(secret))
    return null;
  return { ...supabase, origin, secret };
}
export function recoveryClient(
  config: NonNullable<ReturnType<typeof recoveryConfiguration>>,
) {
  return createClient(config.url, config.key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      flowType: "implicit",
    },
  });
}
