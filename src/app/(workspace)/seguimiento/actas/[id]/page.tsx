import Link from "next/link";
import {notFound} from "next/navigation";
import {requireAccess} from "@/lib/auth/session";
import {validUuid} from "@/lib/auth/validation";
import {fmtHours} from "@/lib/seguimiento/model";
import {PrintAct} from "@/features/seguimiento/print-act";
export const dynamic="force-dynamic";
type SnapshotRow={id:string;date:string;consultant:string;description:string;hours:number|string;work_item_id:string|null};
export default async function ActPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 if(!validUuid(id))notFound();
 const a=await requireAccess(),db=a.supabase,org=a.organizationId;
 const {data:act,error}=await db.from("project_hour_acts")
  .select("id,project_id,number,period_from,period_to,total_hours,snapshot,created_at,prepared_by")
  .eq("organization_id",org).eq("id",id).maybeSingle();
 if(error||!act)notFound();
 const {data:project}=await db.from("projects").select("id,name,client_id,contract_id")
  .eq("organization_id",org).eq("id",act.project_id).maybeSingle();
 if(!project)notFound();
 const [client,contract,setting,activities]=await Promise.all([
  db.from("clients").select("legal_name,document_number").eq("organization_id",org).eq("id",project.client_id).maybeSingle(),
  project.contract_id?db.from("contracts").select("number,title").eq("organization_id",org).eq("id",project.contract_id).maybeSingle():Promise.resolve({data:null}),
  db.from("project_hour_settings").select("contracted_hours").eq("organization_id",org).eq("project_id",project.id).maybeSingle(),
  db.from("project_work_items").select("id,title").eq("organization_id",org).eq("project_id",project.id).limit(500)
 ]);
 if(!Array.isArray(act.snapshot))notFound();
 const rows=act.snapshot as SnapshotRow[];
 const activityNames=new Map((activities.data||[]).map(v=>[v.id,v.title]));
 const total=rows.reduce((sum,item)=>sum+Number(item.hours||0),0);
 const validTotal=Math.abs(total-Number(act.total_hours))<0.001;
 return <article className="mx-auto max-w-5xl space-y-6">
  <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
   <Link className="text-teal-800 underline" href={"/seguimiento/"+project.id}>← Volver al proyecto</Link><PrintAct/>
  </div>
  <header className="border-b-4 border-teal-800 pb-6">
   <div className="flex items-center justify-between gap-4"><div><strong className="text-2xl tracking-wide">AIGENTERRA S.A.S.</strong>
    <p className="text-sm text-slate-500">GeoAI · Sistemas de información geográfica · Servicios profesionales</p></div>
    <p className="text-right text-sm font-semibold">ACT-{String(act.number).padStart(4,"0")}<br/>Copia de consumo</p></div>
   <h1 className="mt-8 text-3xl font-bold">Acta de consumo de horas</h1>
   <p className="mt-2 text-sm text-slate-600">Registro generado a partir de horas aprobadas. No representa aceptación ni firma del cliente.</p>
  </header>
  <section className="grid gap-4 rounded-lg border p-5 text-sm sm:grid-cols-2 print:break-inside-avoid">
   <div><span className="text-slate-500">Cliente</span><p className="font-semibold">{client.data?.legal_name||"No especificado"}</p></div>
   <div><span className="text-slate-500">Proyecto</span><p className="font-semibold">{project.name}</p></div>
   <div><span className="text-slate-500">Contrato / orden</span><p>{contract.data?contract.data.number+" — "+contract.data.title:"No asociado"}</p></div>
   <div><span className="text-slate-500">Periodo reportado</span><p>{act.period_from} al {act.period_to}</p></div>
   <div><span className="text-slate-500">Emitida el</span><p>{new Date(act.created_at).toLocaleString("es-CO",{timeZone:"America/Bogota"})}</p></div>
   <div><span className="text-slate-500">Horas de esta acta</span><p className="font-semibold">{fmtHours(act.total_hours)}</p></div>
  </section>
  <section><h2 className="mb-3 text-xl font-semibold">Detalle de actividades ejecutadas</h2>
   <table className="w-full border-collapse text-left text-xs sm:text-sm"><thead><tr>{["Fecha","Actividad","Responsable","Descripción del trabajo","Horas"].map(h=><th key={h} className="border bg-slate-100 p-2">{h}</th>)}</tr></thead>
    <tbody>{rows.map(row=><tr key={row.id} className="break-inside-avoid">
     <td className="border p-2">{row.date}</td>
     <td className="border p-2">{row.work_item_id?activityNames.get(row.work_item_id)||"Actividad archivada":"Actividad general"}</td>
     <td className="border p-2">{row.consultant}</td>
     <td className="border whitespace-pre-wrap break-words p-2">{row.description}</td>
     <td className="border p-2 text-right">{fmtHours(row.hours)}</td>
    </tr>)}</tbody><tfoot><tr className="font-bold"><td className="border p-2" colSpan={4}>Total horas ejecutadas en esta acta</td><td className="border p-2 text-right">{fmtHours(act.total_hours)}</td></tr></tfoot></table>
   {!validTotal&&<p role="alert" className="mt-3 text-red-700">La suma del detalle requiere revisión contable antes de presentar el acta.</p>}
  </section>
  <section className="rounded-lg border p-5 text-sm">
   <h2 className="mb-2 font-semibold">Constancia de consumo</h2>
   <p>Las horas enumeradas corresponden a registros aprobados del proyecto y se incluyen una sola vez en este documento. La copia queda conservada en el sistema para trazabilidad y no se altera cuando se registran nuevas actividades.</p>
   <p className="mt-3">Horas contratadas de referencia: {setting.data?.contracted_hours==null?"No definidas":fmtHours(setting.data.contracted_hours)}. Este dato es informativo y puede cambiar con nuevas órdenes de servicio.</p>
  </section>
  <section className="grid gap-8 pt-14 sm:grid-cols-2 print:break-inside-avoid">
   <div className="border-t border-slate-500 pt-3 text-sm"><strong>Elaboró / AIGENTERRA</strong><p>Nombre, cargo y firma: _______________________</p><p>Fecha: _______________________</p></div>
   <div className="border-t border-slate-500 pt-3 text-sm"><strong>Recibido / Cliente</strong><p>Nombre, cargo y firma: _______________________</p><p>Fecha: _______________________</p></div>
  </section>
  <footer className="border-t pt-4 text-xs text-slate-500">Acta ACT-{String(act.number).padStart(4,"0")} · Registro de horas aprobadas · AIGENTERRA S.A.S. · Emisión electrónica no firmada</footer>
 </article>;
}
