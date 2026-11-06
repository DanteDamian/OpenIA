import Link from "next/link";
import { requireAccess } from "@/lib/auth/session";
import { canEditProposals, proposalStatusLabels, type ProposalStatus } from "@/lib/proposals/model";
import { NewProposalForm } from "@/features/proposals/new-proposal-form";
export default async function ProposalsPage() {
  const access = await requireAccess();
  const [proposals, clients, calls] = await Promise.all([
    access.supabase.from("proposals").select("id,code,version,title,status,updated_at,clients(legal_name),calls_for_proposals(name)").eq("organization_id", access.organizationId).order("updated_at", { ascending: false }).limit(100),
    access.supabase.from("clients").select("id,legal_name").eq("organization_id", access.organizationId).eq("status", "active").order("legal_name"),
    access.supabase.from("calls_for_proposals").select("id,name").eq("organization_id", access.organizationId).order("created_at", { ascending: false }),
  ]);
  return <><p className="eyebrow">CRM</p><div className="mt-2 flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-semibold text-[#12233D]">Propuestas</h1><p className="mt-3 max-w-2xl text-sm text-slate-500">Crea propuestas corporativas vinculadas con Clientes y Convocatorias, controla presupuesto y aprobación, y genera DOCX o PDF.</p></div>{canEditProposals(access.role) && <NewProposalForm clients={(clients.data || []).map((item) => ({ id: item.id, label: item.legal_name }))} calls={(calls.data || []).map((item) => ({ id: item.id, label: item.name }))} />}</div>
    {(proposals.error || clients.error || calls.error) && <p role="alert" className="card mt-6 p-5 text-red-700">No fue posible cargar el módulo. Verifica que la migración CRM Propuestas esté aplicada en este entorno.</p>}
    {!proposals.error && <section className="card mt-6 overflow-x-auto p-5"><table className="w-full min-w-[720px] text-left text-sm"><caption className="sr-only">Propuestas de la organización</caption><thead><tr>{["Código","Propuesta","Cliente","Convocatoria","Estado","Acción"].map((label) => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{(proposals.data || []).map((proposal) => { const client = proposal.clients as unknown as { legal_name: string } | null; const call = proposal.calls_for_proposals as unknown as { name: string } | null; return <tr key={proposal.id} className="border-t"><td className="p-3 font-semibold">{proposal.code} · v{proposal.version}</td><td className="p-3">{proposal.title}</td><td className="p-3">{client?.legal_name || "Sin cliente"}</td><td className="p-3">{call?.name || "Sin vincular"}</td><td className="p-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs">{proposalStatusLabels[proposal.status as ProposalStatus]}</span></td><td className="p-3"><Link href={`/propuestas/${proposal.id}`} className="font-medium text-teal-800 underline">Abrir editor</Link></td></tr>; })}</tbody></table>{!proposals.data?.length && <p className="p-5 text-sm text-slate-500">Todavía no hay propuestas. Crea la primera sin afectar las demás secciones del CRM.</p>}</section>}
  </>;
}

