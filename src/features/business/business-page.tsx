import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/auth/session";
import { validUuid } from "@/lib/auth/validation";
import { resources, translations, canWrite, type BusinessRow } from "@/lib/business/model";
import { portfolio } from "@/lib/business/portfolio";
import { relationChoices } from "@/lib/business/data";
import { listOptions, literalSearch, type ListParams } from "@/lib/clients/model";
import { Pagination } from "@/features/clients/pagination";
import { BusinessForm } from "./business-form";
import { cents, formatMoney } from "@/lib/business/validation";
export async function BusinessPage({resource,params={},id}: {resource:string;params?:ListParams;id?:string}) {
  const definition=Object.hasOwn(resources,resource) ? resources[resource] : null;
  if(!definition) notFound();
  const access=await requireAccess();
  if(id && !validUuid(id)) notFound();
  const options=listOptions(params);
  const allowedStatuses=definition.fields.find(field=>field.name===definition.statusField)?.options || [];
  const filterStatus=typeof params.status === "string" && allowedStatuses.includes(params.status) ? params.status : "";
  let query=access.supabase.from(definition.table).select(["id",...definition.fields.map(field=>field.type==="money" ? `${field.name}::text` : field.name),...(resource==="cotizaciones" ? ["total::text"] : [])].join(","),{count:"exact"}).eq("organization_id",access.organizationId);
  const projectFilter=resource==="actividades" && typeof params.project_id==="string" && validUuid(params.project_id) ? params.project_id : "";
  if(projectFilter) query=query.eq("project_id",projectFilter);
  if(id) query=query.eq("id",id);
  else {
    if(options.q) query=query.ilike(definition.label,`%${literalSearch(options.q)}%`);
    if(filterStatus) query=query.eq(definition.statusField!,filterStatus);
  }
  const {data,error,count}=await query.order("created_at",{ascending:false}).order("id").range(id ? 0 : (options.page-1)*25,id ? 0 : options.page*25-1);
  if(!error && id && !data?.length) notFound();
  let choices: Awaited<ReturnType<typeof relationChoices>>={}; let choiceError=false;
  try { choices=await relationChoices(access.supabase,access.organizationId,resource); } catch { choiceError=true; }
  const rows=(data || []) as unknown as BusinessRow[]; const row=rows[0];
  const projectSummary=id && resource==="proyectos" ? (await portfolio(access).catch(()=>null))?.projectSummary.find(project=>project.id===id) : undefined;
  const canEdit=canWrite(access.role,definition) && !error && !choiceError;
  const display=(key:string,value:string|null) => {
    const field=definition.fields.find(field=>field.name===key);
    if(!value) return "Sin registrar";
    if(field?.relation) return choices[field.relation]?.find(choice=>choice.id===value)?.label || "Relación no disponible";
    if(field?.type === "money" || key === "total") { try{return formatMoney(cents(value));}catch{return "Importe inválido";} }
    return translations[value] || value;
  };
  return <>
    {id && <Link href={`/${resource}`} className="text-sm text-teal-800 underline">← Volver al listado</Link>}
    <p className="eyebrow mt-4">ESPACIO DE TRABAJO</p><h1 className="mt-2 text-3xl font-semibold">{id ? String(row?.[definition.label] || definition.title) : definition.title}</h1>
    <p className="mt-3 text-sm text-slate-500">Información real de tu organización · COP</p>
    {error && <p role="alert" className="card mt-6 p-6 text-red-700">No fue posible consultar los registros.</p>}
    {choiceError && <p role="alert" className="card mt-6 p-6 text-red-700">No fue posible cargar las relaciones. Recarga antes de guardar.</p>}
    {canEdit && <BusinessForm resource={resource} choices={choices} row={id ? row : undefined} defaults={projectFilter ? {project_id:projectFilter} : {}} />}
    {!id && <form key={`${options.q}:${filterStatus}`} method="get" className="mt-6 flex flex-wrap gap-3">
      {projectFilter && <input type="hidden" name="project_id" value={projectFilter} />}
      <label className="text-sm">Buscar<input name="q" type="search" maxLength={100} defaultValue={options.q} className="ml-2 rounded-lg border bg-white p-3" /></label>
      <label className="text-sm">Estado<select name="status" defaultValue={filterStatus} className="ml-2 rounded-lg border bg-white p-3"><option value="">Todos</option>{allowedStatuses.map(value=><option key={value} value={value}>{translations[value] || value}</option>)}</select></label>
      <button type="submit" className="button-primary">Buscar</button><Link href={`/${resource}`} className="p-3 text-sm underline">Limpiar</Link>
    </form>}
    {!error && <section className="card mt-6 overflow-x-auto p-6">
      {id ? <dl className="grid gap-5 sm:grid-cols-2">{[...definition.fields.map(field=>({name:field.name,label:field.label})),...(resource === "cotizaciones" ? [{name:"total",label:"Total calculado COP"}] : [])].map(field=><div key={field.name}><dt className="text-sm text-slate-500">{field.label}</dt><dd className="mt-2 whitespace-pre-wrap break-words">{display(field.name,row?.[field.name])}</dd></div>)}</dl>
        : !rows.length ? <p className="text-sm text-slate-500">No hay registros para esta consulta.</p>
        : <table className="w-full text-left text-sm"><caption className="sr-only">Registros autorizados</caption><thead><tr>{["Registro","Estado","Consulta"].map(label=><th key={label} scope="col" className="p-3">{label}</th>)}</tr></thead><tbody>{rows.map(item=><tr key={item.id} className="border-t"><td className="p-3">{item[definition.label]}</td><td className="p-3">{display(definition.statusField || "status",item[definition.statusField || "status"])}</td><td className="p-3"><Link href={`/${resource}/${item.id}`} className="text-teal-800 underline">Ver detalle</Link></td></tr>)}</tbody></table>}
      {!id && <Pagination base={`/${resource}`} options={{...options,status:filterStatus}} total={count || 0} extra={projectFilter ? {project_id:projectFilter} : {}} />}
    </section>}
    {id && resource === "proyectos" && <section className="card mt-6 p-6"><h2 className="font-semibold">Seguimiento del proyecto</h2><Link href={`/actividades?project_id=${id}`} className="mt-3 inline-block text-teal-800 underline">Actividades, entregables e hitos</Link><p className="mt-2 text-sm text-slate-500">Presupuesto registrado: {display("budget",row.budget)}</p>{projectSummary ? <p className="mt-2 text-sm">Gastos registrados: {projectSummary.expenses} · Avance de actividades: {projectSummary.completedItems} de {projectSummary.totalItems} finalizadas.</p> : <p role="alert" className="mt-2 text-sm text-red-700">No fue posible calcular los indicadores del proyecto.</p>}</section>}
  </>;
}
