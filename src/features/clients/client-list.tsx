import { requireAccess } from "@/lib/auth/session";
import { canManageClients } from "@/lib/auth/validation";
import { NewClientForm } from "./new-client-form";
export async function ClientList() {
  const access = await requireAccess();
  const { data, error } = await access.supabase
    .from("clients")
    .select("id,legal_name,email,status")
    .eq("organization_id", access.organizationId)
    .order("created_at", { ascending: false })
    .limit(100);
  return (
    <>
      <p className="eyebrow">ESPACIO DE TRABAJO</p>
      <h1 className="mt-2 text-3xl font-semibold">Clientes</h1>
      <p className="mt-3 text-sm text-slate-500">
        Información de la empresa autorizada para tu sesión.
      </p>
      {canManageClients(access.role) && <NewClientForm />}
      <section className="card mt-8 overflow-x-auto p-6">
        {error ? (
          <p role="alert" className="text-sm text-red-700">
            No fue posible consultar los clientes. Intenta nuevamente.
          </p>
        ) : !data?.length ? (
          <p className="text-sm text-slate-500">
            Todavía no hay clientes registrados en tu empresa.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <caption className="sr-only">
              Clientes de la empresa autorizada, hasta 100 registros recientes
            </caption>
            <thead>
              <tr className="border-b border-slate-200">
                <th scope="col" className="p-3">
                  Cliente
                </th>
                <th scope="col" className="p-3">
                  Correo
                </th>
                <th scope="col" className="p-3">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((client) => (
                <tr key={client.id} className="border-b border-slate-100">
                  <td className="p-3">{client.legal_name}</td>
                  <td className="p-3">
                    {client.email || "Sin correo registrado"}
                  </td>
                  <td className="p-3">
                    {client.status === "active" ? "Activo" : "Inactivo"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
