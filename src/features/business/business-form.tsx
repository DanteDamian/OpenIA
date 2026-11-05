"use client";
import { useState } from "react";
import { RecordForm, type Field } from "@/features/clients/record-form";
import { resources, translations, type Choice, type BusinessRow } from "@/lib/business/model";
import { businessInput } from "@/lib/business/validation";
export function BusinessForm({ resource, choices, row, defaults = {} }: {
  resource: string; choices: Record<string,Choice[]>; row?: BusinessRow; defaults?: Record<string,string>;
}) {
  const definition = resources[resource];
  const [clientId,setClientId] = useState(row?.client_id || defaults.client_id || "");
  const fields: Field[] = definition.fields.map(field => {
    const scoped = field.relation && field.relation !== "clients" && clientId;
    const options = field.options ? field.options.map(value => ({value,label:translations[value] || value}))
      : field.relation ? (choices[field.relation] || []).filter(choice => !scoped || !choice.clientId || choice.clientId === clientId)
        .map(choice => ({value:choice.id,label:choice.label})) : undefined;
    const optionalOptions = options ? [{value:"",label:field.required ? "Selecciona…" : "Sin vincular"},...options] : undefined;
    const dependent = field.relation && ["contacts","opportunities","quotes","contracts"].includes(field.relation);
    return { name:field.name,label:field.label,required:field.required,max:field.max || (field.type === "money" ? 19 : 200),
      type:field.type === "textarea" || field.type === "date" ? field.type : undefined, options:optionalOptions,
      initial:dependent && clientId !== (row?.client_id || defaults.client_id || "") ? null : row?.[field.name] ?? defaults[field.name] ?? null };
  });
  return <RecordForm title={row ? `Editar: ${definition.title}` : `Nuevo registro: ${definition.title}`}
    triggerLabel={row ? "Editar registro" : "+ Nuevo registro"} endpoint={`/api/business/${resource}${row ? `?id=${row.id}` : ""}`}
    method={row ? "PATCH" : "POST"} fields={fields} validate={input => businessInput(resource,input) !== null}
    validationMessage="Revisa campos obligatorios, relaciones, fechas e importes COP. Usa punto decimal, máximo dos decimales y sin separadores de miles."
    onFieldChange={(name,value) => { if(name === "client_id") setClientId(value); }}
    successMessage="Registro guardado correctamente." help="Registra información real. Los importes COP usan punto decimal, sin separadores de miles. Los campos opcionales pueden quedar vacíos." />;
}
