"use client";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {useMemo,useState,type DragEvent} from "react";
import {kanbanColumns,kanbanKindLabel,boardCounts,overdue,type KanbanItem,type WorkStatus} from "@/lib/kanban/model";
type Props={projectId:string;projectName:string;items:KanbanItem[];names:Record<string,string>;canEdit:boolean};
const labels:Record<WorkStatus,string>={pending:"Por hacer",in_progress:"En ejecución",done:"Terminadas",cancelled:"Canceladas"};
const tone:Record<string,string>={pending:"bg-slate-100 text-slate-700",in_progress:"bg-amber-100 text-amber-800",done:"bg-emerald-100 text-emerald-800"};
const hourFormat=(hours:number)=>new Intl.NumberFormat("es-CO",{maximumFractionDigits:2}).format(hours);
const dateToday=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"America/Bogota",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
export function KanbanBoard({projectId,projectName,items,names,canEdit}:Props){
 const router=useRouter();
 const [rows,setRows]=useState(items);
 const [search,setSearch]=useState("");
 const [person,setPerson]=useState("");
 const [busy,setBusy]=useState<string|null>(null);
 const [message,setMessage]=useState("");
 const [dragged,setDragged]=useState<string|null>(null);
 const [over,setOver]=useState<WorkStatus|null>(null);
 const [showCancelled,setShowCancelled]=useState(false);
 const today=dateToday();
 const counts=boardCounts(rows);
 const totalActive=counts.pending+counts.in_progress+counts.done;
 const progress=totalActive>0?Math.round(counts.done/totalActive*100):0;
 const people=useMemo(()=>[...new Set(rows.filter(r=>r.assignee_id).map(r=>r.assignee_id!))]
  .sort((a,b)=>(names[a]||a).localeCompare(names[b]||b,"es")),[rows,names]);
 const filtered=useMemo(()=>rows.filter(r=>{
  const matches=r.title.toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es"))||
   (r.description||"").toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es"));
  return matches&&(!person||r.assignee_id===person);
 }).sort((a,b)=>(a.due_on===null?1:b.due_on===null?-1:a.due_on.localeCompare(b.due_on))||a.title.localeCompare(b.title,"es")),[rows,search,person]);
 async function move(item:KanbanItem,to:WorkStatus){
  if(!canEdit||busy||item.status===to)return;
  setBusy(item.id);setMessage("");
  try{
   const response=await fetch("/api/kanban/mover",{method:"PATCH",
    headers:{"Content-Type":"application/json"},body:JSON.stringify({id:item.id,projectId,from:item.status,to})});
   const data=await response.json();
   if(!response.ok)throw Error(data.error||"No se pudo mover la actividad.");
   setRows(old=>old.map(row=>row.id===item.id?{...row,status:to,updated_at:data.item.updated_at}:row));
   setMessage("Actividad movida a "+labels[to]+".");
   router.refresh();
  }catch(e){
   setMessage(e instanceof Error?e.message:"Error al actualizar. Recarga el tablero.");
   router.refresh();
  }finally{setBusy(null);}
 }
 function onDrop(e:DragEvent<HTMLElement>,target:WorkStatus){
  e.preventDefault();setOver(null);
  const id=e.dataTransfer.getData("text/plain")||dragged;
  const item=rows.find(row=>row.id===id);
  setDragged(null);
  if(item)void move(item,target);
 }
 const renderCard=(item:KanbanItem)=><article key={item.id}
    draggable={canEdit&&!busy} onDragStart={e=>{e.dataTransfer.setData("text/plain",item.id);e.dataTransfer.effectAllowed="move";setDragged(item.id);}}
    onDragEnd={()=>{setDragged(null);setOver(null);}}
    aria-label={item.title+"; "+labels[item.status]}
    className={"group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md "+(dragged===item.id?"opacity-50":"")}>
   <div className="mb-3 flex items-start justify-between gap-2">
    <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">{kanbanKindLabel[item.kind]||item.kind}</span>
    {canEdit&&<span aria-hidden="true" title="Arrastra esta tarjeta a otra columna" className="cursor-grab text-lg text-slate-400">⠿</span>}
   </div>
   <h3 className="break-words text-sm font-semibold leading-snug text-slate-900">{item.title}</h3>
   {item.description&&<p title={item.description} className="mt-2 line-clamp-3 break-words text-xs leading-relaxed text-slate-600">{item.description}</p>}
   <div className="mt-4 space-y-2 border-t pt-3 text-xs text-slate-600">
    <div className="flex flex-wrap justify-between gap-2"><span>Responsable</span><span className="font-medium text-slate-900">{item.assignee_id?names[item.assignee_id]||"Miembro asignado":"Sin asignar"}</span></div>
    <div className="flex flex-wrap justify-between gap-2"><span>Fecha límite</span>
      <span className={overdue(item,today)?"font-semibold text-red-700":"font-medium"}>{item.due_on||"Sin definir"}{overdue(item,today)?" · Atrasada":""}</span></div>
    <div className="flex flex-wrap justify-between gap-2"><span>Horas registradas</span><span className="font-medium text-slate-900">{hourFormat(item.hours_logged||0)} h</span></div>
   </div>
   {canEdit&&<div className="mt-4 space-y-1"><label className="block text-[11px] font-semibold text-slate-500" htmlFor={"status-"+item.id}>Mover a</label>
      <select id={"status-"+item.id} aria-label={"Mover "+item.title+" a otra columna"} disabled={!!busy}
       value={item.status} onChange={e=>void move(item,e.target.value as WorkStatus)}
       className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs disabled:opacity-60">
       {kanbanColumns.map(col=><option key={col.status} value={col.status}>{col.name}</option>)}
       <option value="cancelled">Canceladas (archivo)</option>
      </select></div>}
   {item.status!=="cancelled"&&<div className="mt-3 flex justify-end">
      <Link className="text-xs font-semibold text-teal-800 underline underline-offset-2" href={"/seguimiento/"+projectId}>Ver horas y actas ↗</Link>
    </div>}
  </article>;
 return <section aria-label={"Tablero Kanban de "+projectName} className="space-y-5">
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
   {[
     ["Por hacer",counts.pending],["En ejecución",counts.in_progress],["Terminadas",counts.done],["Avance",progress+" %"]
   ].map(([label,value])=><div className="card p-4" key={label}><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></div>)}
  </div>
  <div className="card flex flex-wrap items-center justify-between gap-4 p-4">
   <div className="flex flex-wrap items-center gap-3">
    <label className="text-sm" htmlFor="kanban-search">Buscar</label>
    <input id="kanban-search" className="w-52 rounded-lg border bg-white p-2 text-sm" type="search" value={search}
     onChange={e=>setSearch(e.target.value)} placeholder="Actividad o descripción"/>
    <label className="text-sm" htmlFor="kanban-person">Responsable</label>
    <select id="kanban-person" className="max-w-52 rounded-lg border bg-white p-2 text-sm" value={person} onChange={e=>setPerson(e.target.value)}>
      <option value="">Todos</option>{people.map(id=><option key={id} value={id}>{names[id]||"Miembro"}</option>)}
    </select>
    {(search||person)&&<button type="button" className="text-sm text-teal-800 underline" onClick={()=>{setSearch("");setPerson("");}}>Limpiar</button>}
   </div>
   <p className="text-xs text-slate-600">{filtered.filter(item=>item.status!=="cancelled").length} actividades visibles · {counts.cancelled} archivadas</p>
  </div>
  {message&&<p role="status" className="rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm">{message}</p>}
  {!canEdit&&<p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Tablero de solo lectura: necesitas rol Gestor/Administrador y un proyecto abierto para mover tarjetas.</p>}
  <div className="grid gap-4 lg:grid-cols-3" aria-label="Columnas del tablero">
   {kanbanColumns.map(col=>{
    const list=filtered.filter(item=>item.status===col.status);
    const warning=col.status==="in_progress"&&counts.in_progress>5;
    return <section key={col.status} aria-label={col.name}
     onDragOver={e=>{if(!canEdit)return;e.preventDefault();e.dataTransfer.dropEffect="move";setOver(col.status);}}
     onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setOver(null);}}
     onDrop={e=>onDrop(e,col.status)}
     className={"flex min-h-64 flex-col rounded-2xl border-2 p-3 transition-colors "+col.tone+(over===col.status?" ring-2 ring-teal-600 ring-offset-2":"")}>
     <div className="flex items-center justify-between gap-3 p-2">
      <h2 className="flex items-center gap-2 font-bold"><span className={"h-2.5 w-2.5 rounded-full "+col.dot}/>{col.name}</h2>
      <span className="rounded-full bg-white px-3 py-1 text-sm font-bold shadow-sm">{list.length}</span>
     </div>
     {warning&&<p className="mx-2 mb-3 rounded-md bg-amber-100 p-2 text-xs font-semibold text-amber-800">Atención: más de 5 tareas en ejecución. Considera terminar antes de iniciar otras.</p>}
     <div className="flex flex-1 flex-col gap-3 p-1">
      {list.length?list.map(renderCard):<div className="grid min-h-28 place-items-center rounded-xl border border-dashed border-slate-300 bg-white/70 p-4 text-center text-sm text-slate-500">
        {canEdit?"Arrastra aquí una actividad o usa el selector «Mover a»":"Sin actividades en esta columna"}</div>}
     </div>
    </section>;
   })}
  </div>
  {counts.cancelled>0&&<section className="card p-5">
    <button type="button" className="text-sm font-semibold text-slate-700 underline" onClick={()=>setShowCancelled(!showCancelled)}
     aria-expanded={showCancelled}> {showCancelled?"Ocultar":"Ver"} actividades canceladas ({counts.cancelled})</button>
    {showCancelled&&<div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{filtered.filter(i=>i.status==="cancelled").map(renderCard)}</div>}
   </section>}
  <p className="text-xs leading-relaxed text-slate-600">Este tablero usa los mismos registros y estados del módulo Actividades y entregables. «Terminadas» indica finalización de la actividad, no aprobación automática de horas ni cierre del proyecto. El límite de 5 tareas en ejecución es una alerta orientativa, no una restricción contractual.</p>
 </section>;
}
