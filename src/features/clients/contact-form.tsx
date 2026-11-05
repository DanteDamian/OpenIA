"use client";
import { contactInput } from "@/lib/auth/validation";
import type { ContactRecord } from "@/lib/clients/model";
import { RecordForm, type Field } from "./record-form";
export function ContactForm({ clientId, contact }: { clientId: string; contact?: ContactRecord }) {
  const fields: Field[] = [
    { name: "full_name", label: "Nombre del contacto", max: 200, required: true },
    { name: "job_title", label: "Cargo (opcional)", max: 200 },
    { name: "email", label: "Correo del contacto (opcional)", max: 254, type: "email" },
    { name: "phone", label: "Teléfono del contacto (opcional)", max: 40, type: "tel" },
  ].map(field => ({ ...field, initial: contact?.[field.name as keyof ContactRecord] ?? null } as Field));
  return <RecordForm key={contact ? contact.id : "new-contact"}
    title={contact ? "Editar contacto" : "Nuevo contacto"}
    triggerLabel={contact ? `Editar contacto: ${contact.full_name}` : "+ Nuevo contacto"}
    endpoint={`/api/clients/${encodeURIComponent(clientId)}/contacts${contact ? `?id=${encodeURIComponent(contact.id)}` : ""}`}
    method={contact ? "PATCH" : "POST"} fields={fields} validate={input => contactInput(input) !== null}
    successMessage={contact ? "Contacto actualizado correctamente." : "Contacto registrado correctamente."}
    help="El contacto se vincula al cliente de esta ficha. No se envían correos al guardarlo." />;
}
