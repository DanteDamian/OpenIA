import Link from "next/link";
import { requireAccess } from "@/lib/auth/session";
import { canManageClients } from "@/lib/auth/validation";
import { listOptions, type ListParams, type ClientRecord } from "@/lib/clients/model";
import { queryClients } from "@/lib/clients/query";
import { NewClientForm } from "./new-client-form";
import { Pagination } from "./pagination";
export async function ClientList({ params = {} }: { params?: ListParams } = {}) {
  const access = await requireAccess();
  const options = listOptions(params);
  const { data, error, count } = await queryClients(access.supabase, access.organizationId, options);
  const clients = (data || []) as ClientRecord[];
  return <>
    <p className="eyebrow">ESPACIO DE TRABAJO</p>
    <h1 className="mt-2 text-3xl font-semibold">Clientes</h1>
    <p className="mt-3 text-sm text-slate-500">Información de la empresa autorizada para tu sesión.</p>
    {canManageClients(access.role) && <NewClientForm />}
    <form key={JSON.stringify(options)} action="/clientes" method="get" className="mt-8 flex flex-wrap items-end gap-4">
      <div className="min-w-48 flex-1">
        <label htmlFor="client-search" className="text-sm font-medium">Buscar por nombre o razón social</label>
        <input id="client-search" name="q" defaultValue={options.q} maxLength={100} type="search"
          className="mt-2 block w-full rounded-lg border border-slate-300 bg-white p-3" />
      </div>
      <div><label htmlFor="client-status" className="text-sm font-medium">Estado</label>
        <select id="client-status" name="status" defaultValue={options.status} className="mt-2 block rounded-lg border border-slate-300 bg-white p-3">
          <option value="">Todos</option><option value="active">Activos</option><option value="inactive">Inactivos</option>
        </select>
      </div>
      <button className="button-primary" type="submit">Buscar</button>
      <Link href="/clientes" className="px-2 py-3 text-sm underline">Limpiar filtros</Link>
    </form>
    <section className="card mt-6 overflow-x-auto p-6">
      {error ? <p role="alert" className="text-sm text-red-700">No fue posible consultar los clientes. Intenta nuevamente.</p>
        : !clients.length ? <p className="text-sm text-slate-500">{options.q || options.status || options.page > 1
          ? "No hay clientes para estos filtros o esta página." : "Todavía no hay clientes registrados en tu empresa."}</p>
        : <table className="w-full text-left text-sm">
          <caption className="sr-only">Clientes de la empresa autorizada, 25 por página</caption>
          <thead><tr className="border-b border-slate-200">{["Cliente", "Identificación", "Correo", "Estado", "Acciones"].map(label => <th key={label} scope="col" className="p-3">{label}</th>)}</tr></thead>
          <tbody>{clients.map(client => <tr key={client.id} className="border-b border-slate-100">
            <td className="p-3"><Link href={`/clientes/${client.id}`} className="font-medium text-teal-800 underline">{client.legal_name}</Link></td>
            <td className="p-3">{client.document_number ? `${client.document_type} ${client.document_number}` : "Sin identificación"}</td>
            <td className="p-3">{client.email || "Sin correo registrado"}</td>
            <td className="p-3"><span className={`rounded-full px-3 py-1 ${client.status === "active" ? "bg-teal-50 text-teal-800" : "bg-slate-100 text-slate-600"}`}>{client.status === "active" ? "Activo" : "Inactivo"}</span></td>
            <td className="p-3"><Link href={`/clientes/${client.id}`} className="text-teal-800 underline" aria-label={`Ver ficha de ${client.legal_name}`}>Ver ficha</Link></td>
          </tr>)}</tbody>
        </table>}
      {!error && <Pagination base="/clientes" options={options} total={count || 0} />}
    </section>
  </>;
}
