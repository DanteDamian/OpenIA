import { getAccess } from "@/lib/auth/session";
import { sameOrigin, validUuid } from "@/lib/auth/validation";
import { boundedJson, json } from "@/lib/auth/http";
import { resources, canWrite } from "@/lib/business/model";
import { businessInput } from "@/lib/business/validation";
type Context = { params: Promise<{ resource: string }> };
async function save(request: Request, context: Context, editing: boolean) {
  if (!sameOrigin(request)) return json({ error: "Origen no autorizado." },403);
  const access = await getAccess();
  if (access.status !== "authorized") return json({ error: "Acceso no autorizado." },access.status === "unauthenticated" ? 401 : 403);
  const key = (await context.params).resource;
  const definition = Object.hasOwn(resources,key) ? resources[key] : null;
  if (!definition) return json({ error: "Módulo no disponible." },404);
  if (!canWrite(access.role,definition)) return json({ error: "Permisos insuficientes." },403);
  const id = new URL(request.url).searchParams.get("id");
  if (editing && !validUuid(id)) return json({ error: "Identificador inválido." },400);
  const input = businessInput(key,await boundedJson(request));
  if (!input) return json({ error: "Revisa campos, fechas e importes." },400);
  // Cada relación se consulta con la sesión real y organización verificadas.
  let relatedClientId = input.client_id;
  for (const field of definition.fields.filter(field => field.relation && input[field.name])) {
    const related = await access.supabase.from(field.relation!).select("*").eq("organization_id",access.organizationId).eq("id",input[field.name]!).maybeSingle();
    if (related.error) return json({ error: "No fue posible validar las relaciones." },503);
    if (!related.data || (relatedClientId && related.data.client_id && related.data.client_id !== relatedClientId))
      return json({ error: "La relación no pertenece al cliente o empresa autorizados." },400);
    if (related.data.client_id) relatedClientId = related.data.client_id;
  }
  const table = access.supabase.from(definition.table);
  const query = editing ? table.update(input).eq("organization_id",access.organizationId).eq("id",id!) : table.insert({...input,organization_id:access.organizationId});
  const { data,error } = await query.select("id").maybeSingle();
  if (error) return json({ error: "No fue posible guardar. Comprueba relaciones y referencias duplicadas." },400);
  if (!data) return json({ error: "Registro no disponible." },404);
  return json({ record:data },editing ? 200 : 201);
}
export async function POST(request: Request, context: Context) { return save(request,context,false); }
export async function PATCH(request: Request, context: Context) { return save(request,context,true); }
