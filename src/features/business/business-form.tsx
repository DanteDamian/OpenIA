"use client";
import { useState } from "react";
import { RecordForm, type Field } from "@/features/clients/record-form";
import { resources, translations, type Choice, type BusinessRow } from "@/lib/business/model";
import { businessInput } from "@/lib/business/validation";

const expenseCategories = [
  "Constitución y trámites",
  "Servicios profesionales",
  "Dominio y correo corporativo",
  "Infraestructura en la nube",
  "Suscripciones de IA",
  "Consumo de IA por API",
  "Software y licencias",
  "Datos y licencias geoespaciales",
  "Comercial y mercadeo",
  "Comisiones bancarias y de pago",
  "Oficina y administración",
  "Capacitación y certificaciones",
  "Otros gastos de operación",
];

function expenseCategoryOptions(current: string | null) {
  const options = expenseCategories.map(category => ({ value: category, label: category }));
  if (current && !expenseCategories.includes(current)) {
    options.push({ value: current, label: current + " (categoría registrada)" });
  }
  return options;
}

export function BusinessForm({ resource, choices, row, defaults = {} }: {
  resource: string; choices: Record<string,Choice[]>; row?: BusinessRow; defaults?: Record<string,string>;
}) {
  const definition = resources[resource];
  const isExpense = resource === "gastos";
  const [clientId,setClientId] = useState(row?.client_id || defaults.client_id || "");
  const fields: Field[] = definition.fields.map(field => {
    const scoped = field.relation && field.relation !== "clients" && clientId;
    const initial = row?.[field.name] ?? defaults[field.name] ?? null;
    const options = isExpense && field.name === "category" ? expenseCategoryOptions(initial)
      : field.options ? field.options.map(value => ({value,label:translations[value] || value}))
      : field.relation ? (choices[field.relation] || []).filter(choice => !scoped || !choice.clientId || choice.clientId === clientId)
        .map(choice => ({value:choice.id,label:choice.label,disabled:choice.unavailable && choice.id !== row?.[field.name]})) : undefined;
    const emptyLabel = isExpense && field.name === "project_id" ? "Operación de la empresa"
      : field.required ? "Selecciona…" : field.relation ? "Sin vincular" : "Sin registrar";
    const optionalOptions = options ? [{value:"",label:emptyLabel},...options] : undefined;
    const dependent = field.relation && ["contacts","opportunities","quotes","contracts"].includes(field.relation);
    return { name:field.name,label:field.label,required:field.required,max:field.max || (field.type === "money" ? 19 : 200),
      type:field.type === "textarea" || field.type === "date" || field.type === "url" ? field.type : undefined, options:optionalOptions,
      initial:dependent && clientId !== (row?.client_id || defaults.client_id || "") ? null : initial };
  });
  return <RecordForm title={row ? `Editar: ${definition.title}` : `Nuevo registro: ${definition.title}`}
    triggerLabel={row ? (isExpense ? "Editar gasto" : "Editar registro") : (isExpense ? "+ Registrar gasto" : "+ Nuevo registro")} endpoint={`/api/business/${resource}${row ? `?id=${row.id}` : ""}`}
    method={row ? "PATCH" : "POST"} fields={fields} validate={input => businessInput(resource,input) !== null}
    validationMessage="Revisa campos obligatorios, relaciones, fechas e importes COP. Usa punto decimal, máximo dos decimales y sin separadores de miles."
    onFieldChange={(name,value) => { if(name === "client_id") setClientId(value); }}
    successMessage={isExpense ? "Gasto guardado correctamente." : "Registro guardado correctamente."}
    help={isExpense ? "Usa Operación de la empresa para gastos generales o elige el proyecto al que corresponda el gasto. Registra el valor en COP y la referencia del soporte si la tienes."
      : resource === "actividades" ? "Los usuarios que aún no tienen nombre aparecen como Nombre pendiente. Un administrador puede registrarlo en Usuarios." : "Registra información real. Los importes COP usan punto decimal, sin separadores de miles. Los campos opcionales pueden quedar vacíos."} />;
}
