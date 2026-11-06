import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/auth/session";
import { validUuid } from "@/lib/auth/validation";
import { ProposalEditor } from "@/features/proposals/proposal-editor";
import { proposalStatusLabels, type ProposalItem, type ProposalStatus } from "@/lib/proposals/model";
export default async function ProposalDetail({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireAccess(); const { id } = await params; if (!validUuid(id)) notFound();
  const [proposal, sections, items] = await Promise.all([
    access.supabase.from("proposals").select("id,code,version,title,status,valid_until,clients(legal_name),calls_for_proposals(name)").eq("organization_id", access.organizationId).eq("id", id).maybeSingle(),
    access.supabase.from("proposal_sections").select("section_key,title,content,position").eq("organization_id", access.organizationId).eq("proposal_id", id).order("position"),
    access.supabase.from("proposal_items").select("id,description,quantity::text,unit_price::text,discount_amount::text,tax_amount::text,subtotal::text,total::text,position").eq("organization_id", access.organizationId).eq("proposal_id", id).order("position"),
  ]);
  if (proposal.error || !proposal.data) notFound();
  const client = proposal.data.clients as unknown as { legal_name: string } | null; const call = proposal.data.calls_for_proposals as unknown as { name: string } | null;
  return <><Link href="/propuestas" className="text-sm text-teal-800 underline">← Volver a Propuestas</Link><div className="mt-4 flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow">{proposal.data.code} · VERSIÓN {proposal.data.version}</p><h1 className="mt-2 text-3xl font-semibold text-[#12233D]">{proposal.data.title}</h1><p className="mt-3 text-sm text-slate-500">Cliente: {client?.legal_name || "No disponible"} · Convocatoria: {call?.name || "Sin vincular"}</p></div><span className="rounded-full bg-teal-50 px-3 py-2 text-sm font-medium text-teal-800">{proposalStatusLabels[proposal.data.status as ProposalStatus]}</span></div>
    {(sections.error || items.error) ? <p role="alert" className="card mt-6 p-5 text-red-700">No fue posible cargar el contenido de la propuesta.</p> : <ProposalEditor id={id} status={proposal.data.status as ProposalStatus} role={access.role} sections={sections.data || []} items={(items.data || []) as unknown as ProposalItem[]} />}
  </>;
}
