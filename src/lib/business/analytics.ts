import { cents, formatMoney } from "./validation";
import type { BusinessRow } from "./model";
export type Portfolio = Record<string,BusinessRow[]>;
export function analyze(data: Portfolio) {
  const sum=(rows:BusinessRow[],field:string)=>rows.reduce((total,row)=>row[field] ? total+cents(row[field]!) : total,0n);
  const expenses=(data.expenses || []).filter(row=>row.status === "recorded");
  const cash=(data.cash_movements || []).filter(row=>row.status === "recorded");
  const income=sum(cash.filter(row=>row.direction === "income"),"amount");
  const outgoing=sum(cash.filter(row=>row.direction === "outgoing"),"amount");
  const spend=sum(expenses,"amount");
  const projects=data.projects || []; const opportunities=data.opportunities || [];
  const pipeline=sum(opportunities.filter(row=>!["won","lost"].includes(row.stage || "")),"estimated_amount");
  const alerts:string[]=[];
  const today=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Bogota",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  for(const project of projects) {
    const actual=sum(expenses.filter(row=>row.project_id === project.id),"amount");
    if(project.budget && actual>cents(project.budget)) alerts.push(`Presupuesto excedido: ${project.name}. Gastos ${formatMoney(actual)}.`);
    if(project.ends_on && project.ends_on<today && !["completed","cancelled"].includes(project.status || "")) alerts.push(`Proyecto con fecha final vencida: ${project.name}.`);
  }
  for(const item of data.project_work_items || []) if(item.due_on && item.due_on<today && !["done","cancelled"].includes(item.status || "")) alerts.push(`Actividad pendiente vencida: ${item.title}.`);
  for(const item of opportunities) if(item.expected_close_date && item.expected_close_date<today && !["won","lost"].includes(item.stage || "")) alerts.push(`Revisar cierre de oportunidad: ${item.title}.`);
  return { income:formatMoney(income), outgoing:formatMoney(outgoing), cashNet:formatMoney(income-outgoing),
    expenses:formatMoney(spend), pipeline:formatMoney(pipeline), activeProjects:projects.filter(row=>row.status === "active").length,
    projectCount:projects.length, opportunityCount:opportunities.length, alerts,
    projectSummary: projects.map(project=>({id:project.id,name:project.name,status:project.status,
      completedItems:(data.project_work_items || []).filter(item=>item.project_id===project.id && item.status==="done").length,
      totalItems:(data.project_work_items || []).filter(item=>item.project_id===project.id && item.status!=="cancelled").length,
      budget:project.budget ? formatMoney(cents(project.budget)) : "Sin presupuesto registrado",
      expenses:formatMoney(sum(expenses.filter(row=>row.project_id === project.id),"amount"))})),
    note:"Tesorería refleja movimientos efectivos registrados; gastos reflejan egresos registrados por separado. No se suman ambos ni se equipara cartera comercial con ingresos. Valores en COP." };
}
