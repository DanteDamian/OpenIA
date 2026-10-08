import { getAccess } from "@/lib/auth/session";
import {
  clientInput,
  canManageClients,
  sameOrigin,
  validUuid,
} from "@/lib/auth/validation";
import { boundedJson, json } from "@/lib/auth/http";
function accessError(status: string) {
  return json(
    { error: "No tienes acceso a esta operación." },
    status === "unauthenticated" ? 401 : status === "forbidden" ? 403 : 503,
  );
}
export async function GET() {
  const access = await getAccess();
  if (access.status !== "authorized") return accessError(access.status);
  const { data, error } = await access.supabase
    .from("clients")
    .select("id,legal_name,email,status")
    .eq("organization_id", access.organizationId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return json({ error: "No fue posible consultar clientes." }, 503);
  return json({ clients: data });
}
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return json({ error: "Solicitud no autorizada." }, 403);
  const access = await getAccess();
  if (access.status !== "authorized") return accessError(access.status);
  if (!canManageClients(access.role))
    return json({ error: "No tienes permisos de edición." }, 403);
  const input = clientInput(await boundedJson(request));
  if (!input) return json({ error: "Datos de cliente inválidos." }, 400);
  const { data, error } = await access.supabase
    .from("clients")
    .insert({ ...input, organization_id: access.organizationId })
    .select("id")
    .single();
  if (error)
    return json({ error: "No fue posible registrar el cliente." }, 400);
  return json({ client: data }, 201);
}
export async function PATCH(request: Request) {
  if (!sameOrigin(request))
    return json({ error: "Solicitud no autorizada." }, 403);
  const access = await getAccess();
  if (access.status !== "authorized") return accessError(access.status);
  if (!canManageClients(access.role))
    return json({ error: "No tienes permisos de edición." }, 403);
  const id = new URL(request.url).searchParams.get("id");
  if (!validUuid(id)) return json({ error: "Identificador inválido." }, 400);
  const input = clientInput(await boundedJson(request));
  if (!input) return json({ error: "Datos de cliente inválidos." }, 400);
  const { data, error } = await access.supabase
    .from("clients")
    .update(input)
    .eq("id", id)
    .eq("organization_id", access.organizationId)
    .select("id")
    .maybeSingle();
  if (error)
    return json({ error: "No fue posible actualizar el cliente." }, 400);
  if (!data) return json({ error: "Registro no disponible." }, 404);
  return json({ client: data });
}
