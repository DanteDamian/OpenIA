import { getAccess } from "@/lib/auth/session";
import { boundedJson, json } from "@/lib/auth/http";
import { sameOrigin, validUuid } from "@/lib/auth/validation";
import { canEditProposals, proposalSectionKeys, type ProposalSectionKey } from "@/lib/proposals/model";
type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, context: Context) {
  if (!sameOrigin(request)) return json({ error: "Origen no autorizado." }, 403);
  const access = await getAccess();
  if (access.status !== "authorized") return json({ error: "Acceso no autorizado." }, 401);
  if (!canEditProposals(access.role)) return json({ error: "Permisos insuficientes." }, 403);
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_ENABLED !== "true") return json({ error: "La redacción IA no está habilitada en este entorno." }, 503);
  const id = (await context.params).id; if (!validUuid(id)) return json({ error: "Identificador inválido." }, 400);
  const raw = await boundedJson(request) as { sectionKey?: unknown; instructions?: unknown } | null;
  if (!raw || typeof raw.sectionKey !== "string" || !proposalSectionKeys.includes(raw.sectionKey as ProposalSectionKey) || typeof raw.instructions !== "string" || !raw.instructions.trim() || raw.instructions.length > 1000) return json({ error: "Solicitud inválida." }, 400);
  const proposal = await access.supabase.from("proposals").select("code,title,valid_until,clients(legal_name),calls_for_proposals(name,issuer_name,topic)").eq("organization_id", access.organizationId).eq("id", id).maybeSingle();
  if (proposal.error || !proposal.data) return json({ error: "Propuesta no disponible." }, 404);
  const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" }, signal: AbortSignal.timeout(30000), body: JSON.stringify({
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini", max_output_tokens: 1400,
    instructions: "Redacta únicamente la sección solicitada de una propuesta comercial de AIGENTERRA en español profesional. Usa solo los datos suministrados. No inventes cifras, fechas, NIT, impuestos, condiciones, garantías, equipo ni compromisos. Cuando falte un dato necesario escribe [POR DEFINIR]. No reutilices identidad ni cláusulas de Procalculo. Devuelve JSON estricto.",
    input: JSON.stringify({ sectionKey: raw.sectionKey, request: raw.instructions.trim(), authorizedData: proposal.data }),
    text: { format: { type: "json_schema", name: "proposal_section", strict: true, schema: { type: "object", properties: { sectionKey: { type: "string", enum: [raw.sectionKey] }, content: { type: "string" }, assumptionsRequired: { type: "array", items: { type: "string" } } }, required: ["sectionKey", "content", "assumptionsRequired"], additionalProperties: false } } },
  }) });
  if (!response.ok) return json({ error: "El proveedor IA no está disponible." }, 503);
  const result = await response.json() as { status?: string; output?: { content?: { type: string; text?: string; refusal?: string }[] }[] };
  const output = result.output?.flatMap((entry) => entry.content || []).find((entry) => entry.type === "output_text")?.text;
  if (result.status !== "completed" || !output) return json({ error: "La redacción no produjo una salida utilizable." }, 503);
  try { const parsed = JSON.parse(output) as { sectionKey: string; content: string; assumptionsRequired: string[] }; return json({ suggestion: parsed }); } catch { return json({ error: "La salida estructurada no pudo validarse." }, 503); }
}

