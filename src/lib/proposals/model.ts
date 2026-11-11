export const proposalSections = [
  { key: "carta", title: "Carta de presentación" },
  { key: "resumen", title: "Resumen ejecutivo" },
  { key: "objetivos", title: "Objetivos" },
  { key: "alcance", title: "Alcance" },
  { key: "metodologia", title: "Metodología" },
  { key: "entregables", title: "Entregables" },
  { key: "cronograma", title: "Cronograma" },
  { key: "equipo", title: "Equipo" },
  { key: "riesgos", title: "Riesgos" },
  { key: "responsabilidades_exclusiones", title: "Responsabilidades y exclusiones" },
  { key: "oferta_economica", title: "Oferta económica" },
  { key: "condiciones_comerciales", title: "Condiciones comerciales" },
  { key: "garantias", title: "Garantías" },
  { key: "aceptacion", title: "Aceptación" },
] as const;

export type ProposalSectionKey = (typeof proposalSections)[number]["key"];
export const proposalSectionKeys = proposalSections.map((section) => section.key);

export const proposalStatuses = ["draft", "review", "pending_approval", "approved", "rejected", "sent", "accepted", "expired"] as const;
export type ProposalStatus = (typeof proposalStatuses)[number];
export const proposalStatusLabels: Record<ProposalStatus, string> = {
  draft: "Borrador", review: "En revisión", pending_approval: "Pendiente de aprobación",
  approved: "Aprobada", rejected: "Rechazada", sent: "Enviada", accepted: "Aceptada", expired: "Vencida",
};

export type ProposalItem = {
  id: string; description: string; quantity: string; unit_price: string;
  discount_amount: string; tax_amount: string; subtotal: string; total: string; position: number;
};

export function canEditProposals(role: string) {
  return role === "admin" || role === "manager";
}

