import { getAccess } from "@/lib/auth/session";
import { canManageClients, contactInput, sameOrigin, validUuid } from "@/lib/auth/validation";
import { boundedJson, json } from "@/lib/auth/http";

type Context = { params: Promise<{ id: string }> };
async function write(request: Request, context: Context, editing: boolean) {
  if (!sameOrigin(request)) return json({ error: "Solicitud no autorizada." }, 403);
  const access = await getAccess();
  if (access.status !== "authorized")
    return json({ error: "No tienes acceso a esta operación." }, access.status === "unauthenticated" ? 401 : access.status === "forbidden" ? 403 : 503);
  if (!canManageClients(access.role)) return json({ error: "No tienes permisos de edición." }, 403);
  const clientId = (await context.params).id;
  const contactId = new URL(request.url).searchParams.get("id");
  if (!validUuid(clientId) || (editing && !validUuid(contactId)))
    return json({ error: "Identificador inválido." }, 400);
  const input = contactInput(await boundedJson(request), editing);
  if (!input) return json({ error: "Datos de contacto inválidos." }, 400);
  const parent = await access.supabase.from("clients").select("id")
    .eq("organization_id", access.organizationId).eq("id", clientId).maybeSingle();
  if (parent.error) return json({ error: "No fue posible consultar el cliente." }, 503);
  if (!parent.data) return json({ error: "Registro no disponible." }, 404);
  const contacts = access.supabase.from("contacts");
  const query = editing
    ? contacts.update(input).eq("organization_id", access.organizationId).eq("client_id", clientId).eq("id", contactId!)
    : contacts.insert({ ...input, organization_id: access.organizationId, client_id: clientId });
  const { data, error } = await query.select("id").maybeSingle();
  if (error) return json({ error: "No fue posible guardar el contacto." }, 400);
  if (!data) return json({ error: "Registro no disponible." }, 404);
  return json({ contact: data }, editing ? 200 : 201);
}
export async function POST(request: Request, context: Context) { return write(request, context, false); }
export async function PATCH(request: Request, context: Context) { return write(request, context, true); }
