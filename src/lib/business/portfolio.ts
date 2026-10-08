import "server-only";
import { requireAccess } from "@/lib/auth/session";
import { allRows } from "./data";
import { analyze, type Portfolio } from "./analytics";
export async function portfolio(access: Awaited<ReturnType<typeof requireAccess>>) {
  const tables=["opportunities","projects","expenses","cash_movements","project_work_items"];
  const entries=await Promise.all(tables.map(async table=>[table,await allRows(access.supabase,access.organizationId,table)] as const));
  return analyze(Object.fromEntries(entries) as Portfolio);
}
