"use client";

import { RecordForm } from "@/features/clients/record-form";

export function MemberNameForm({ userId, displayName }: { userId: string; displayName: string | null }) {
  return <RecordForm
    title="Nombre del usuario"
    triggerLabel="Editar nombre"
    endpoint={`/api/users/${userId}/display-name`}
    method="PATCH"
    fields={[{ name: "display_name", label: "Nombre", required: true, max: 200, initial: displayName }]}
    help="Este nombre identifica al usuario en Actividades y Kanban de esta empresa."
    successMessage="Nombre actualizado."
    showServerError
  />;
}
