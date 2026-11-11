import { createHash } from "node:crypto";
import { getAccess } from "@/lib/auth/session";
import { json } from "@/lib/auth/http";
import { validUuid } from "@/lib/auth/validation";
import { createDocx, createPdf, type ProposalDocumentData } from "@/lib/proposals/documents";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  const access = await getAccess(); if (access.status !== "authorized") return json({ error: "Acceso no autorizado." }, 401);
  const id = (await context.params).id; if (!validUuid(id)) return json({ error: "Identificador inválido." }, 400);
  const format = new URL(request.url).searchParams.get("format"); if (format !== "docx" && format !== "pdf") return json({ error: "Formato inválido." }, 400);
  const [proposal, sections, items] = await Promise.all([
    access.supabase.from("proposals").select("code,version,title,valid_until,clients(legal_name)").eq("organization_id", access.organizationId).eq("id", id).maybeSingle(),
    access.supabase.from("proposal_sections").select("title,content,position").eq("organization_id", access.organizationId).eq("proposal_id", id).order("position"),
    access.supabase.from("proposal_items").select("id,description,quantity::text,unit_price::text,discount_amount::text,tax_amount::text,subtotal::text,total::text,position").eq("organization_id", access.organizationId).eq("proposal_id", id).order("position"),
  ]);
  if (proposal.error || !proposal.data || sections.error || items.error) return json({ error: "No fue posible preparar el documento." }, 404);
  const relation = proposal.data.clients as unknown as { legal_name: string } | { legal_name: string }[] | null;
  const clientName = Array.isArray(relation) ? relation[0]?.legal_name : relation?.legal_name;
  const data: ProposalDocumentData = { code: proposal.data.code, version: proposal.data.version, title: proposal.data.title,
    validUntil: proposal.data.valid_until, clientName: clientName || "Cliente", sections: sections.data || [], items: (items.data || []) as never };
  const bytes = format === "docx" ? await createDocx(data) : await createPdf(data);
  const safeCode = proposal.data.code.replace(/[^A-Za-z0-9_-]/g, "-"); const fileName = `${safeCode}-v${proposal.data.version}.${format}`;
  const path = `${access.organizationId}/${id}/${Date.now()}-${fileName}`;
  const contentType = format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const upload = await access.supabase.storage.from("proposal-documents").upload(path, bytes, { contentType, upsert: false });
  if (upload.error) return json({ error: "No fue posible almacenar el documento privado." }, 503);
  await access.supabase.from("proposal_documents").insert({ organization_id: access.organizationId, proposal_id: id, format, storage_path: path, file_name: fileName, byte_size: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
  return new Response(new Uint8Array(bytes), { headers: { "Content-Type": contentType, "Content-Disposition": `attachment; filename="${fileName}"`, "Cache-Control": "private, no-store" } });
}
