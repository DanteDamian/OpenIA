"use client";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {useState,type FormEvent} from "react";
import {fmtHours} from "@/lib/seguimiento/model";
type Project={id:string;name:string;status:string};
type Activity={id:string;title:string;kind:string;status:string};
type Entry={id:string;project_id:string;work_item_id:string|null;activity_date:string;consultant_name:string;description:string;hours:string|number;status:string;act_id:string|null};
type Act={id:string;number:number;period_from:string;period_to:string;total_hours:number;created_at:string};
type Settings={contracted_hours:string|number|null;notes:string|null}|null;
const blank={activity_date:"",work_item_id:"",consultant_name:"",description:"",hours:""};
export function ProjectHours({project,activities,entries,acts,settings,canEdit}:{project:Project;activities:Activity[];entries:Entry[];acts:Act[];settings:Settings;canEdit:boolean}){
 const router=useRouter();
 const [form,setForm]=useState(blank);
 const [editId,setEditId]=useState<string|null>(null);
 const [hoursBudget,setHoursBudget]=useState(settings?.contracted_hours==null?"":String(settings.contracted_hours));
 const [notes,setNotes]=useState(settings?.notes||"");
 const [start,setStart]=useState(""),[end,setEnd]=useState("");
 const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const approved=entries.filter(x=>x.status==="approved").reduce((total,x)=>total+Number(x.hours),0);
 const draft=entries.filter(x=>x.status==="draft").reduce((total,x)=>total+Number(x.hours),0);
 const reported=approved+draft,contracted=settings?.contracted_hours==null?null:Number(settings.contracted_hours);
 const remaining=contracted==null?null:contracted-approved;
 async function call(url:string,method:string,payload:Record<string,unknown>){
  setBusy(true);setMessage("");
  try{
   const response=await fetch(url,{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
   const result=await response.json();
   if(!response.ok)throw Error(result.error||"La operación no se completó");
   setMessage("Cambio guardado correctamente.");
   router.refresh();
   return result;
  }catch(e){setMessage(e instanceof Error?e.message:"Error de operación");return null;}
  finally{setBusy(false);}
 }
 async function submitHours(e:FormEvent){e.preventDefault();
  const payload={project_id:project.id,...form,work_item_id:form.work_item_id||null};
  const result=await call("/api/seguimiento/horas"+(editId?"?id="+encodeURIComponent(editId):""),editId?"PATCH":"POST",editId?{action:"edit",...payload}:payload);
  if(result){setForm(blank);setEditId(null);}
 }
 function edit(entry:Entry){setEditId(entry.id);setForm({activity_date:entry.activity_date,work_item_id:entry.work_item_id||"",consultant_name:entry.consultant_name,description:entry.description,hours:String(entry.hours)});window.scrollTo({top:0,behavior:"smooth"});}
 async function issue(e:FormEvent){e.preventDefault();
  const result=await call("/api/seguimiento/actas","POST",{project_id:project.id,from:start,to:end});
  if(result?.act_id)router.push("/seguimiento/actas/"+result.act_id);
 }
 return <div className="space-y-6">
  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
   {[
    ["Horas contratadas",contracted==null?"Sin definir":fmtHours(contracted)],
    ["Horas aprobadas",fmtHours(approved)],
    ["Horas en borrador",fmtHours(draft)],
    ["Saldo vs. aprobadas",remaining==null?"Sin definir":fmtHours(remaining)]
   ].map(([label,value])=><div key={label} className="card p-5"><div className="text-xs text-slate-500">{label}</div><div className="mt-3 text-2xl font-semibold">{value}</div></div>)}
  </div>
  <p className="text-sm text-slate-600">Horas registradas: {fmtHours(reported)}. Las horas aprobadas incluidas en actas anteriores siguen contando en el total consumido. Una alerta de saldo negativo no impide reportar trabajo real.</p>
  {message&&<div role="status" className="rounded-lg border border-teal-200 bg-teal-50 p-4 text-sm">{message}</div>}
  <section className="card p-6">
   <h2 className="text-xl font-semibold">Bolsa de horas contratadas</h2>
   <p className="mt-1 text-sm text-slate-600">Define la cantidad de horas acordadas comercialmente; no se deduce automáticamente del presupuesto en pesos.</p>
   {canEdit?<form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={async e=>{e.preventDefault();await call("/api/seguimiento/configuracion","PATCH",{project_id:project.id,contracted_hours:hoursBudget||null,notes});}}>
     <label className="text-sm">Horas pactadas<input className="mt-1 block w-48 rounded-lg border p-3" type="number" min="0" max="99999999" step=".01" value={hoursBudget} onChange={e=>setHoursBudget(e.target.value)} placeholder="Sin definir"/></label>
     <label className="min-w-64 flex-1 text-sm">Observaciones de la bolsa<input maxLength={1000} className="mt-1 block w-full rounded-lg border p-3" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Orden de servicio / soporte contractual"/></label>
     <button disabled={busy} type="submit" className="button-primary disabled:opacity-40">Guardar bolsa</button>
    </form>:<p className="mt-3 text-sm">{notes||"Sin observaciones."}</p>}
  </section>
  <section className="card p-6">
   <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">Actividades y horas empleadas</h2>
    <Link href={"/actividades?project_id="+project.id} className="text-sm text-teal-800 underline">Gestionar actividades y entregables ↗</Link></div>
   <p className="mt-2 text-sm text-slate-600">Registra horas reales por fecha, profesional y actividad. El flujo es Borrador → Aprobado → Incluido en acta.</p>
   {canEdit&&!["completed","cancelled"].includes(project.status)&&<form onSubmit={submitHours} className="mt-5 grid gap-4 rounded-xl border bg-slate-50 p-4 md:grid-cols-2">
    <h3 className="md:col-span-2 font-semibold">{editId?"Editar borrador":"Nuevo registro de horas"}</h3>
    <label className="text-sm">Fecha de ejecución<input required type="date" className="mt-1 block w-full rounded border bg-white p-3" value={form.activity_date} onChange={e=>setForm({...form,activity_date:e.target.value})}/></label>
    <label className="text-sm">Responsable / profesional<input required minLength={2} maxLength={160} className="mt-1 block w-full rounded border bg-white p-3" value={form.consultant_name} onChange={e=>setForm({...form,consultant_name:e.target.value})}/></label>
    <label className="text-sm">Actividad del proyecto<select className="mt-1 block w-full rounded border bg-white p-3" value={form.work_item_id} onChange={e=>setForm({...form,work_item_id:e.target.value})}>
     <option value="">Sin actividad asociada</option>{activities.map(a=><option key={a.id} value={a.id}>{a.title} · {a.kind}</option>)}
    </select></label>
    <label className="text-sm">Horas empleadas<input required type="number" min=".01" max="24" step=".01" className="mt-1 block w-full rounded border bg-white p-3" value={form.hours} onChange={e=>setForm({...form,hours:e.target.value})}/></label>
    <label className="text-sm md:col-span-2">Trabajo realizado<textarea required minLength={4} maxLength={2000} rows={3} className="mt-1 block w-full rounded border bg-white p-3" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label>
    <div className="flex gap-3 md:col-span-2"><button disabled={busy} className="button-primary disabled:opacity-40" type="submit">{editId?"Guardar cambios":"Registrar horas"}</button>
    {editId&&<button className="rounded-lg border px-4 py-2" type="button" onClick={()=>{setEditId(null);setForm(blank);}}>Cancelar</button>}</div>
   </form>}
   {!entries.length?<p className="mt-6 text-sm text-slate-600">Todavía no se han reportado horas. Agrega una actividad y registra el primer consumo.</p>:
    <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[800px] text-left text-sm"><thead><tr>{["Fecha","Actividad","Profesional","Trabajo realizado","Horas","Estado","Acta","Acciones"].map(x=><th className="border-b p-2" key={x}>{x}</th>)}</tr></thead>
     <tbody>{entries.map(entry=><tr className="border-b" key={entry.id}>
      <td className="p-2">{entry.activity_date}</td><td className="p-2">{activities.find(a=>a.id===entry.work_item_id)?.title||"General"}</td>
      <td className="p-2">{entry.consultant_name}</td><td className="max-w-sm whitespace-pre-wrap break-words p-2">{entry.description}</td>
      <td className="p-2 font-medium">{fmtHours(entry.hours)}</td><td className="p-2">{entry.act_id?"Incluido en acta":entry.status==="approved"?"Aprobado":"Borrador"}</td>
      <td className="p-2">{entry.act_id?<Link href={"/seguimiento/actas/"+entry.act_id} className="text-teal-800 underline">Consultar</Link>:"—"}</td>
      <td className="space-x-3 p-2">{canEdit&&!entry.act_id&&<>
       {entry.status==="draft"&&<button className="text-teal-800 underline" onClick={()=>edit(entry)}>Editar</button>}
       <button disabled={busy} className="text-teal-800 underline disabled:opacity-40" onClick={()=>call("/api/seguimiento/horas?id="+entry.id,"PATCH",{action:entry.status==="draft"?"approve":"reopen"})}>{entry.status==="draft"?"Aprobar":"Reabrir"}</button>
      </>}</td>
     </tr>)}</tbody></table></div>}
  </section>
  <section className="card p-6">
   <h2 className="text-xl font-semibold">Actas de consumo de horas</h2>
   <p className="mt-2 text-sm text-slate-600">Cada acta consolida únicamente horas aprobadas que todavía no figuran en otra acta. Su contenido queda congelado para trazabilidad. Se puede imprimir o guardar como PDF desde el navegador.</p>
   {canEdit&&<form onSubmit={issue} className="mt-4 flex flex-wrap items-end gap-3">
    <label className="text-sm">Desde<input required type="date" value={start} onChange={e=>setStart(e.target.value)} className="mt-1 block rounded-lg border p-3"/></label>
    <label className="text-sm">Hasta<input required type="date" min={start} value={end} onChange={e=>setEnd(e.target.value)} className="mt-1 block rounded-lg border p-3"/></label>
    <button disabled={busy} className="button-primary disabled:opacity-40" type="submit">Emitir acta de consumo</button>
   </form>}
   {!acts.length?<p className="mt-4 text-sm text-slate-500">Aún no existen actas emitidas.</p>:
   <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{["Acta","Periodo","Horas consolidadas","Emisión","Documento"].map(t=><th className="border-b p-3" key={t}>{t}</th>)}</tr></thead><tbody>
    {acts.map(a=><tr key={a.id} className="border-b"><td className="p-3">ACT-{String(a.number).padStart(4,"0")}</td><td className="p-3">{a.period_from} a {a.period_to}</td>
     <td className="p-3">{fmtHours(a.total_hours)}</td><td className="p-3">{new Date(a.created_at).toLocaleDateString("es-CO")}</td>
     <td className="p-3"><Link href={"/seguimiento/actas/"+a.id} className="text-teal-800 underline">Ver / imprimir</Link></td></tr>)}</tbody></table></div>}
  </section>
 </div>;
}
