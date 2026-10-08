import type { SupabaseClient } from "@supabase/supabase-js";
import { clientColumns, listOptions, literalSearch, pageSize } from "./model";
export function queryClients(supabase: SupabaseClient, organizationId: string, options: ReturnType<typeof listOptions>) {
  let query = supabase.from("clients").select(clientColumns, { count: "exact" }).eq("organization_id", organizationId);
  if (options.q) query = query.ilike("legal_name", `%${literalSearch(options.q)}%`);
  if (options.status) query = query.eq("status", options.status);
  return query.order("created_at", { ascending: false }).order("id", { ascending: true })
    .range((options.page - 1) * pageSize, options.page * pageSize - 1);
}
