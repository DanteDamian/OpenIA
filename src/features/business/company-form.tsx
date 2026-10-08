"use client";
import { RecordForm } from "@/features/clients/record-form";
export function CompanyForm({ company }: { company: Record<string,string|null> }) {
  return <RecordForm title="Editar empresa" triggerLabel="Editar empresa" endpoint="/api/company" method="PATCH"
    fields={[{name:"name",label:"Nombre",required:true,max:200},{name:"tax_id",label:"Identificación",max:40},
      {name:"email",label:"Correo",type:"email",max:254},{name:"phone",label:"Teléfono",type:"tel",max:40},
      {name:"address",label:"Dirección",type:"textarea",max:1000}].map(field=>({...field,initial:company[field.name]})) as import("@/features/clients/record-form").Field[]}
    successMessage="Empresa actualizada correctamente." help="La moneda COP y las membresías no se modifican desde este formulario." />;
}
