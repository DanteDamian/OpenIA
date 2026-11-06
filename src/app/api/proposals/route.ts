import { getAccess } from "@/lib/auth/session";
import { boundedJson, json } from "@/lib/auth/http";
import { sameOrigin } from "@/lib/auth/validation";
import { canEditProposals, proposalSections } from "@/lib/proposals/model";
import { proposalCreateInput } from "@/lib/proposals/validation";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Origen no autorizado." }, 403);
  const access = await getAccess();
  if (access.status !== "authorized") return json({ error: "Acceso no autorizado." }, 401);
  if (!canEditProposals(access.role)) return json({ error: "Permisos insuficientes." }, 403);
  const input = proposalCreateInput(await boundedJson(request));
  if (!input) return json({ error: "Revisa los datos de la propuesta." }, 400);
  const client = await access.supabase.from("clients").select("id").eq("organization_id", access.organizationId).eq("id", input.client_id).maybeSingle();
  if (client.error || !client.data) return json({ error: "El cliente no pertenece a la organización." }, 400);
  if (input.call_for_proposal_id) {
    const call = await access.supabase.from("calls_for_proposals").select("id").eq("organization_id", access.organizationId).eq("id", input.call_for_proposal_id).maybeSingle();
    if (call.error || !call.data) return json({ error: "La convocatoria no pertenece a la organización." }, 400);
  }
  if (input.opportunity_id) {
    const opportunity = await access.supabase.from("opportunities").select("id").eq("organization_id", access.organizationId).eq("client_id", input.client_id).eq("id", input.opportunity_id).maybeSingle();
    if (opportunity.error || !opportunity.data) return json({ error: "La oportunidad no pertenece al cliente." }, 400);
  }
  const created = await access.supabase.from("proposals").insert({ ...input, organization_id: access.organizationId }).select("id").single();
  if (created.error) return json({ error: created.error.code === "23505" ? "El código y versión ya existen." : "No fue posible crear la propuesta." }, 400);
  const sections = proposalSections.map((section, index) => ({ organization_id: access.organizationId, proposal_id: created.data.id, section_key: section.key, title: section.title, position: index + 1, content: "" }));
  const inserted = await access.supabase.from("proposal_sections").insert(sections);
  if (inserted.error) return json({ error: "La propuesta se creó, pero no fue posible inicializar sus secciones." }, 503);
  return json({ proposal: { id: created.data.id } }, 201);
}

