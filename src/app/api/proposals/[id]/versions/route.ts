import { getAccess } from "@/lib/auth/session";
import { json } from "@/lib/auth/http";
import { sameOrigin, validUuid } from "@/lib/auth/validation";
import { canEditProposals } from "@/lib/proposals/model";
type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, context: Context) {
  if (!sameOrigin(request)) return json({ error: "Origen no autorizado." }, 403);
  const access = await getAccess(); if (access.status !== "authorized") return json({ error: "Acceso no autorizado." }, 401);
  if (!canEditProposals(access.role)) return json({ error: "Permisos insuficientes." }, 403);
  const id = (await context.params).id; if (!validUuid(id)) return json({ error: "Identificador inválido." }, 400);
  const [source, sections, items] = await Promise.all([
    access.supabase.from("proposals").select("client_id,call_for_proposal_id,opportunity_id,code,title,currency,valid_until,notes,version").eq("organization_id", access.organizationId).eq("id", id).maybeSingle(),
    access.supabase.from("proposal_sections").select("section_key,title,content,position").eq("organization_id", access.organizationId).eq("proposal_id", id),
    access.supabase.from("proposal_items").select("description,quantity,unit_price,discount_amount,tax_amount,position").eq("organization_id", access.organizationId).eq("proposal_id", id),
  ]);
  if (source.error || !source.data || sections.error || items.error) return json({ error: "No fue posible leer la versión actual." }, 404);
  const latest = await access.supabase.from("proposals").select("version").eq("organization_id", access.organizationId).eq("code", source.data.code).order("version", { ascending: false }).limit(1).single();
  if (latest.error) return json({ error: "No fue posible calcular la siguiente versión." }, 503);
  const { version: _oldVersion, ...copy } = source.data;
  void _oldVersion;
  const created = await access.supabase.from("proposals").insert({ ...copy, organization_id: access.organizationId, version: latest.data.version + 1, status: "draft" }).select("id").single();
  if (created.error) return json({ error: "No fue posible crear la nueva versión." }, 400);
  const copiedSections = await access.supabase.from("proposal_sections").insert((sections.data || []).map((section) => ({ ...section, organization_id: access.organizationId, proposal_id: created.data.id })));
  const copiedItems = !items.data?.length ? { error: null } : await access.supabase.from("proposal_items").insert(items.data.map((item) => ({ ...item, organization_id: access.organizationId, proposal_id: created.data.id })));
  if (copiedSections.error || copiedItems.error) return json({ error: "La versión se creó, pero su contenido no pudo copiarse completamente." }, 503);
  return json({ proposal: { id: created.data.id } }, 201);
}
