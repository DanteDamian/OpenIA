import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/auth/session";
import { canManageClients, validUuid } from "@/lib/auth/validation";
import { clientColumns, contactColumns, listOptions, pageSize, type ClientRecord, type ContactRecord, type ListParams } from "@/lib/clients/model";
import { NewClientForm } from "@/features/clients/new-client-form";
import { ContactForm } from "@/features/clients/contact-form";
import { Pagination } from "@/features/clients/pagination";
export default async function ClientPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<ListParams>;
}) {
  const access = await requireAccess();
  const { id } = await params;
  if (!validUuid(id)) notFound();
  const { data, error } = await access.supabase.from("clients").select(clientColumns)
    .eq("organization_id", access.organizationId).eq("id", id).maybeSingle();
  if (error) return <><Link href="/clientes" className="text-teal-800 underline">Volver a Clientes</Link><p role="alert" className="card mt-6 p-6 text-red-700">No fue posible consultar la ficha. Intenta nuevamente.</p></>;
  if (!data) notFound();
  const client = data as ClientRecord;
  const manage = canManageClients(access.role);
  const options = listOptions({ page: (await searchParams).page });
  const contacts = await access.supabase.from("contacts").select(contactColumns, { count: "exact" })
    .eq("organization_id", access.organizationId).eq("client_id", id)
    .order("created_at", { ascending: false }).order("id", { ascending: true })
    .range((options.page - 1) * pageSize, options.page * pageSize - 1);
  return <>
    <Link href="/clientes" className="text-sm text-teal-800 underline">← Volver a Clientes</Link>
    <p className="eyebrow mt-6">FICHA DEL CLIENTE</p>
    <h1 className="mt-2 break-words text-3xl font-semibold">{client.legal_name}</h1>
    <section aria-label="Datos del cliente" className="card mt-6 p-6">
      <dl className="grid gap-6 sm:grid-cols-2">
        {[
          ["Identificación", client.document_number ? `${client.document_type} ${client.document_number}` : null],
          ["Correo", client.email], ["Teléfono", client.phone], ["Dirección", client.address],
          ["Estado", client.status === "active" ? "Activo" : "Inactivo"],
        ].map(([label, value]) => <div key={label}><dt className="text-sm font-medium text-slate-500">{label}</dt><dd className="mt-2 whitespace-pre-wrap break-words">{value || "Sin registrar"}</dd></div>)}
      </dl>
    </section>
    {manage && <NewClientForm client={client} />}
    <section aria-labelledby="contacts-title" className="mt-10">
      <h2 id="contacts-title" className="text-xl font-semibold">Contactos</h2>
      <p className="mt-2 text-sm text-slate-500">Personas de contacto de este cliente.</p>
      {manage && <ContactForm clientId={id} />}
      {contacts.error ? <p role="alert" className="card mt-6 p-6 text-red-700">No fue posible consultar los contactos. Intenta nuevamente.</p>
        : <>
          {!contacts.data?.length ? <p className="card mt-6 p-6 text-sm text-slate-500">{options.page > 1 ? "No hay contactos en esta página." : "Todavía no hay contactos registrados para este cliente."}</p>
            : <ul className="mt-6 grid gap-4 lg:grid-cols-2">{(contacts.data as ContactRecord[]).map(contact => <li key={contact.id} className="card p-6">
              <h3 className="break-words font-semibold">{contact.full_name}</h3>
              <dl className="mt-4 space-y-3 text-sm">{[["Cargo", contact.job_title], ["Correo", contact.email], ["Teléfono", contact.phone]].map(([label, value]) => <div key={label}><dt className="text-slate-500">{label}</dt><dd className="break-words">{value || "Sin registrar"}</dd></div>)}</dl>
              {manage && <ContactForm clientId={id} contact={contact} />}
            </li>)}</ul>}
          <Pagination base={`/clientes/${id}`} options={options} total={contacts.count || 0} />
        </>}
    </section>
  </>;
}
