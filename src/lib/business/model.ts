export type BusinessField = {
  name: string; label: string; type?: "text" | "date" | "money" | "textarea" | "uuid";
  required?: boolean; max?: number; options?: readonly string[]; relation?: string;
};
export type Resource = { table: string; title: string; label: string; permission: "commercial" | "finance" | "admin";
  fields: BusinessField[]; statusField?: string };
const client = { name: "client_id", label: "Cliente", required: true, relation: "clients", type: "uuid" } as const;
const title = { name: "title", label: "Título", required: true, max: 200 } as const;
const number = { name: "number", label: "Número / referencia", required: true, max: 60 } as const;
const dates: BusinessField[] = [{ name: "starts_on", label: "Inicio", type: "date" }, { name: "ends_on", label: "Fin", type: "date" }];
const status = (values: string[]): BusinessField => ({ name: "status", label: "Estado", required: true, options: values });
const money = (name: string, label: string, required = false): BusinessField => ({ name, label, type: "money", required });
export const resources: Record<string, Resource> = {
  oportunidades: { table: "opportunities", title: "Oportunidades", label: "title", permission: "commercial", statusField: "stage", fields: [client, title,
    { name: "contact_id", label: "Contacto del cliente", relation: "contacts", type: "uuid" },
    { name: "stage", label: "Etapa", required: true, options: ["new","qualified","proposal","won","lost"] },
    money("estimated_amount", "Valor estimado COP"), { name: "expected_close_date", label: "Cierre esperado", type: "date" }] },
  cotizaciones: { table: "quotes", title: "Cotizaciones", label: "number", permission: "commercial", statusField: "status", fields: [client, number,
    { name: "opportunity_id", label: "Oportunidad del cliente", relation: "opportunities", type: "uuid" },
    status(["draft","sent","accepted","rejected","expired"]), { name: "issued_on", label: "Fecha de emisión", type: "date", required: true },
    { name: "valid_until", label: "Válida hasta", type: "date" }, money("subtotal", "Subtotal COP", true), money("discount_amount", "Descuento COP", true), money("tax_amount", "Impuestos COP", true)] },
  contratos: { table: "contracts", title: "Contratos", label: "title", permission: "commercial", statusField: "status", fields: [client, number, title,
    { name: "quote_id", label: "Cotización del cliente", relation: "quotes", type: "uuid" }, status(["draft","active","completed","terminated"]), ...dates, money("amount", "Valor contractual COP", true)] },
  proyectos: { table: "projects", title: "Proyectos", label: "name", permission: "commercial", statusField: "status", fields: [client,
    { name: "name", label: "Nombre", required: true, max: 200 }, { name: "contract_id", label: "Contrato del cliente", relation: "contracts", type: "uuid" },
    status(["planned","active","paused","completed","cancelled"]), ...dates, money("budget", "Presupuesto COP")] },
  gastos: { table: "expenses", title: "Gastos", label: "description", permission: "finance", statusField: "status", fields: [
    { name: "project_id", label: "Proyecto", relation: "projects", type: "uuid" }, { name: "supplier_name", label: "Proveedor", required: true, max: 200 },
    { name: "description", label: "Descripción", required: true, type: "textarea", max: 1000 }, { name: "category", label: "Categoría", required: true, max: 100 },
    money("amount", "Valor COP", true), { name: "incurred_on", label: "Fecha", type: "date", required: true },
    { name: "reference", label: "Referencia / soporte", max: 120 }, status(["recorded","void"])] },
  tesoreria: { table: "cash_movements", title: "Tesorería", label: "description", permission: "finance", statusField: "status", fields: [
    { name: "direction", label: "Movimiento", required: true, options: ["income","outgoing"] },
    { name: "description", label: "Descripción", required: true, type: "textarea", max: 1000 }, money("amount", "Valor efectivo COP", true),
    { name: "occurred_on", label: "Fecha del movimiento", type: "date", required: true },
    { name: "method", label: "Medio", required: true, options: ["bank_transfer","card","cash","other"] },
    { name: "project_id", label: "Proyecto", relation: "projects", type: "uuid" }, { name: "contract_id", label: "Contrato", relation: "contracts", type: "uuid" },
    { name: "reference", label: "Referencia", max: 120 }, status(["recorded","void"])] },
  actividades: { table: "project_work_items", title: "Actividades y entregables", label: "title", permission: "commercial", statusField: "status", fields: [
    { name: "project_id", label: "Proyecto", relation: "projects", type: "uuid", required: true },
    { name: "kind", label: "Tipo", required: true, options: ["activity","deliverable","milestone"] }, title,
    { name: "description", label: "Descripción", type: "textarea", max: 1000 }, status(["pending","in_progress","done","cancelled"]),
    { name: "assignee_id", label: "Responsable (UUID de miembro autorizado)", type: "uuid" }, { name: "due_on", label: "Fecha límite", type: "date" }] },
};
export const translations: Record<string, string> = {
  new: "Nueva", qualified: "Calificada", proposal: "Propuesta", won: "Ganada", lost: "Perdida", draft: "Borrador", sent: "Enviada", accepted: "Aceptada", rejected: "Rechazada", expired: "Vencida",
  active: "Activo", completed: "Completado", terminated: "Terminado", planned: "Planeado", paused: "Pausado", cancelled: "Cancelado", recorded: "Registrado", void: "Anulado",
  income: "Ingreso", outgoing: "Salida", bank_transfer: "Transferencia", card: "Tarjeta", cash: "Efectivo", other: "Otro",
  activity: "Actividad", deliverable: "Entregable", milestone: "Hito", pending: "Pendiente", in_progress: "En progreso", done: "Finalizado",
};
export function canWrite(role: string, resource: Resource) {
  return role === "admin" || (resource.permission === "commercial" && role === "manager") || (resource.permission === "finance" && role === "accountant");
}
export type BusinessRow = Record<string, string | null> & { id: string };
export type Choice = { id: string; label: string; clientId?: string | null };
