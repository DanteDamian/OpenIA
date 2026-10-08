"use client";
import { clientInput } from "@/lib/auth/validation";
import type { ClientRecord } from "@/lib/clients/model";
import { RecordForm, type Field } from "./record-form";
export function NewClientForm({ client }: { client?: ClientRecord }) {
  const fields: Field[] = [
    { name: "legal_name", label: "Nombre o razón social", required: true, max: 200, autoComplete: "organization" },
    { name: "email", label: "Correo electrónico (opcional)", type: "email", max: 254, autoComplete: "email" },
    { name: "document_type", label: "Tipo de identificación (opcional)", max: 20, options: [
      { value: "", label: "Sin identificación" }, { value: "NIT", label: "NIT" }, { value: "CC", label: "Cédula de ciudadanía" },
      { value: "CE", label: "Cédula de extranjería" }, { value: "PASSPORT", label: "Pasaporte" }, { value: "OTHER", label: "Otro" },
    ] },
    { name: "document_number", label: "Número de identificación (opcional)", max: 40 },
    { name: "phone", label: "Teléfono (opcional)", type: "tel", max: 40, autoComplete: "tel" },
    { name: "status", label: "Estado", required: true, max: 20, options: [{ value: "active", label: "Activo" }, { value: "inactive", label: "Inactivo" }] },
    { name: "address", label: "Dirección (opcional)", type: "textarea", max: 1000 },
  ].map(field => ({ ...field, initial: client?.[field.name as keyof ClientRecord] ?? (field.name === "status" ? "active" : null) } as Field));
  return <RecordForm key={client ? client.id : "new"}
    title={client ? "Editar cliente" : "Nuevo cliente"} triggerLabel={client ? "Editar cliente" : "+ Nuevo cliente"}
    endpoint={client ? `/api/clients?id=${encodeURIComponent(client.id)}` : "/api/clients"} method={client ? "PATCH" : "POST"}
    fields={fields} validate={input => clientInput(input) !== null}
    successMessage={client ? "Cliente actualizado correctamente." : "Cliente registrado correctamente."}
    help="Usa información real. La identificación es opcional, pero requiere tipo y número juntos. Inactivar conserva el historial del cliente." />;
}
