import { getAccess } from "@/lib/auth/session";
import { boundedJson, json } from "@/lib/auth/http";
import { sameOrigin, validUuid } from "@/lib/auth/validation";
type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, context: Context) {
  if (!sameOrigin(request)) return json({ error: "Origen no autorizado." }, 403);
  const access = await getAccess();
  if (access.status !== "authorized") return json({ error: "Acceso no autorizado." }, 401);
  if (access.role !== "admin") return json({ error: "Solo un administrador puede decidir la aprobación." }, 403);
  const id = (await context.params).id; if (!validUuid(id)) return json({ error: "Identificador inválido." }, 400);
  const raw = await boundedJson(request) as { decision?: unknown; comment?: unknown } | null;
  if (!raw || !["approved", "rejected"].includes(String(raw.decision)) || (raw.comment != null && (typeof raw.comment !== "string" || raw.comment.length > 2000))) return json({ error: "Decisión inválida." }, 400);
  const proposal = await access.supabase.from("proposals").select("id,status").eq("organization_id", access.organizationId).eq("id", id).eq("status", "pending_approval").maybeSingle();
  if (proposal.error || !proposal.data) return json({ error: "La propuesta no está pendiente de aprobación." }, 409);
  const decision = raw.decision as "approved" | "rejected";
  const [proposalSnapshot, sectionSnapshot, itemSnapshot] = await Promise.all([
    access.supabase.from("proposals").select("*").eq("organization_id", access.organizationId).eq("id", id).single(),
    access.supabase.from("proposal_sections").select("section_key,title,content,position").eq("organization_id", access.organizationId).eq("proposal_id", id).order("position"),
    access.supabase.from("proposal_items").select("description,quantity::text,unit_price::text,discount_amount::text,tax_amount::text,subtotal::text,total::text,position").eq("organization_id", access.organizationId).eq("proposal_id", id).order("position"),
  ]);
  if (proposalSnapshot.error || sectionSnapshot.error || itemSnapshot.error) return json({ error: "No fue posible crear la instantánea de aprobación." }, 503);
  const versionSnapshot = await access.supabase.from("proposal_versions").upsert({ organization_id: access.organizationId, proposal_id: id, version: proposalSnapshot.data.version, snapshot: { proposal: proposalSnapshot.data, sections: sectionSnapshot.data, items: itemSnapshot.data } }, { onConflict: "organization_id,proposal_id,version", ignoreDuplicates: true });
  if (versionSnapshot.error) return json({ error: "No fue posible versionar la propuesta." }, 503);
  const approval = await access.supabase.from("proposal_approvals").insert({ organization_id: access.organizationId, proposal_id: id, decision, comment: typeof raw.comment === "string" ? raw.comment.trim() || null : null }).select("id").single();
  if (approval.error) return json({ error: "No fue posible registrar la decisión." }, 400);
  const update = await access.supabase.from("proposals").update(decision === "approved" ? { status: decision, approved_by: access.userId, approved_at: new Date().toISOString() } : { status: decision, approved_by: null, approved_at: null }).eq("organization_id", access.organizationId).eq("id", id);
  return update.error ? json({ error: "La decisión se registró, pero no fue posible actualizar el estado." }, 503) : json({ saved: true });
}

