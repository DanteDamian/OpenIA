import {validUuid} from "@/lib/auth/validation";

export const kanbanColumns=[
 {status:"pending",name:"Por hacer",tone:"border-slate-300 bg-slate-50",dot:"bg-slate-500"},
 {status:"in_progress",name:"En ejecución",tone:"border-amber-300 bg-amber-50/50",dot:"bg-amber-500"},
 {status:"done",name:"Terminadas",tone:"border-emerald-300 bg-emerald-50/50",dot:"bg-emerald-600"},
] as const;
export type KanbanStatus=typeof kanbanColumns[number]["status"];
export type WorkStatus=KanbanStatus|"cancelled";
export type KanbanItem={
 id:string;project_id:string;title:string;description:string|null;kind:string;status:WorkStatus;
 assignee_id:string|null;due_on:string|null;updated_at:string;hours_logged?:number
};
export function isWorkStatus(value:unknown):value is WorkStatus{
 return value==="pending"||value==="in_progress"||value==="done"||value==="cancelled";
}
export function kanbanTransition(value:unknown):{id:string;projectId:string;from:WorkStatus;to:WorkStatus}|null{
 if(!value||typeof value!=="object"||Array.isArray(value))return null;
 const input=value as Record<string,unknown>;
 if(Object.keys(input).some(k=>!["id","projectId","from","to"].includes(k)))return null;
 if(!validUuid(input.id)||!validUuid(input.projectId)||!isWorkStatus(input.from)||!isWorkStatus(input.to))return null;
 if(input.from===input.to)return null;
 return {id:input.id,projectId:input.projectId,from:input.from,to:input.to};
}
export function boardCounts(items:readonly Pick<KanbanItem,"status">[]){
 return {pending:items.filter(x=>x.status==="pending").length,
  in_progress:items.filter(x=>x.status==="in_progress").length,
  done:items.filter(x=>x.status==="done").length,
  cancelled:items.filter(x=>x.status==="cancelled").length};
}
export function overdue(item:Pick<KanbanItem,"due_on"|"status">,today:string){
 return item.status!=="done"&&item.status!=="cancelled"&&item.due_on!==null&&item.due_on<today;
}
export const kanbanKindLabel:Record<string,string>={activity:"Actividad",deliverable:"Entregable",milestone:"Hito"};
