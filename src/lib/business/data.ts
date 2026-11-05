import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resources, type BusinessRow, type Choice } from "./model";
export async function allRows(supabase: SupabaseClient, org: string, table: string, columns = "*") {
  const definition=Object.values(resources).find(item=>item.table===table);
  if(columns==="*" && definition) columns=["id",...definition.fields.map(field=>field.type==="money" ? `${field.name}::text` : field.name)].join(",");
  const rows: BusinessRow[] = [];
  for (let offset=0;;offset+=1000) {
    const {data,error} = await supabase.from(table).select(columns).eq("organization_id",org).order("id").range(offset,offset+999);
    if(error) throw new Error("No fue posible consultar los datos autorizados.");
    rows.push(...(data || []) as unknown as BusinessRow[]);
    if(!data || data.length < 1000) return rows;
  }
}
export async function relationChoices(supabase: SupabaseClient, org: string, resource: string) {
  const tables = [...new Set(resources[resource].fields.flatMap(field => field.relation ? [field.relation] : []))];
  const result: Record<string,Choice[]> = {};
  for(const table of tables) {
    const label = table === "clients" ? "legal_name" : table === "contacts" ? "full_name"
      : table === "projects" ? "name" : table === "quotes" ? "number" : "title";
    const rows = await allRows(supabase,org,table,`id,${label}${["contacts","opportunities","quotes","contracts","projects"].includes(table) ? ",client_id" : ""}`);
    result[table] = rows.map(row => ({id:row.id,label:String(row[label]),clientId:row.client_id}));
  }
  return result;
}
