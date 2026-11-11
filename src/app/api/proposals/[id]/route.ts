import { getAccess } from "@/lib/auth/session";
import { boundedJson, json } from "@/lib/auth/http";
import { sameOrigin, validUuid } from "@/lib/auth/validation";
import { canEditProposals } from "@/lib/proposals/model";
import { itemInput, sectionInput, statusInput } from "@/lib/proposals/validation";

type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, context: Context) {
  if (!sameOrigin(request)) return json({ error: "Origen no autorizado." }, 403);
  const access = await getAccess();
  if (access.status !== "authorized") return json({ error: "Acceso no autorizado." }, 401);
  if (!canEditProposals(access.role)) return json({ error: "Permisos insuficientes." }, 403);
  const id = (await context.params).id;
  if (!validUuid(id)) return json({ error: "Identificador inválido." }, 400);
  const proposal = await access.supabase.from("proposals").select("id,status").eq("organization_id", access.organizationId).eq("id", id).maybeSingle();
  if (proposal.error || !proposal.data) return json({ error: "Propuesta no disponible." }, 404);
  if (["approved", "sent", "accepted"].includes(proposal.data.status)) return json({ error: "Crea una nueva versión para editar una propuesta aprobada o enviada." }, 409);
  const raw = await boundedJson(request);
  const section = sectionInput(raw);
  if (section) {
    const result = await access.supabase.from("proposal_sections").update({ content: section.content }).eq("organization_id", access.organizationId).eq("proposal_id", id).eq("section_key", section.sectionKey).select("id").maybeSingle();
    return result.error || !result.data ? json({ error: "No fue posible guardar la sección." }, 400) : json({ saved: true });
  }
  const item = itemInput(raw);
  if (item) {
    const values = { description: item.description, quantity: item.quantity, unit_price: item.unit_price, discount_amount: item.discount_amount, tax_amount: item.tax_amount };
    const query = item.id
      ? access.supabase.from("proposal_items").update(values).eq("organization_id", access.organizationId).eq("proposal_id", id).eq("id", item.id)
      : access.supabase.from("proposal_items").insert({ ...values, organization_id: access.organizationId, proposal_id: id });
    const result = await query.select("id,description,quantity::text,unit_price::text,discount_amount::text,tax_amount::text,subtotal::text,total::text,position").maybeSingle();
    return result.error || !result.data ? json({ error: "No fue posible guardar el concepto." }, 400) : json({ item: result.data });
  }
  const status = statusInput(raw);
  if (status && ["draft", "review", "pending_approval"].includes(status)) {
    const result = await access.supabase.from("proposals").update({ status }).eq("organization_id", access.organizationId).eq("id", id).select("id").maybeSingle();
    return result.error || !result.data ? json({ error: "No fue posible cambiar el estado." }, 400) : json({ saved: true });
  }
  return json({ error: "Solicitud inválida." }, 400);
}

