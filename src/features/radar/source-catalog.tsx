"use client";
import {useRouter} from "next/navigation";
import {useState, type FormEvent} from "react";
type Method="manual"|"socrata"|"pncp"|"ted"|"sercop";
type Frequency="daily"|"weekly"|"manual";
type Source={id:string;name:string;country:string;category:string;official_url:string;query_method:Method;frequency:Frequency;enabled:boolean;technical_status:string;last_checked_at:string|null;last_result:string|null};
type Form={name:string;country:string;category:string;official_url:string;query_method:Method;frequency:Frequency;enabled:boolean};
const empty:Form={name:"",country:"Colombia",category:"Contratación",official_url:"",query_method:"manual",frequency:"manual",enabled:false};
const secopOfficialUrl="https://www.datos.gov.co/Estad-sticas-Nacionales/SECOP-II-Procesos-de-Contrataci-n/p6dx-8zbt";
export function SourceCatalog({sources,canEdit}:{sources:Source[];canEdit:boolean}) {
 const router=useRouter();
 const [editing,setEditing]=useState<string|null>(null);
 const [form,setForm]=useState<Form>(empty);
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 function start(row?:Source) {
  setEditing(row?.id??null);
  setForm(row?{name:row.name,country:row.country,category:row.category,official_url:row.official_url,query_method:row.query_method,frequency:row.frequency,enabled:row.enabled}:empty);
  setOpen(true);setMessage("");
 }
 async function save(e:FormEvent<HTMLFormElement>) {
  e.preventDefault();if(busy)return;
  setBusy(true);setMessage("");
  try {
   const response=await fetch("/api/radar/sources"+(editing?"?id="+encodeURIComponent(editing):""),{
    method:editing?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});
   const data=await response.json();
   if(!response.ok)throw Error(data.error||"No fue posible guardar");
   setOpen(false);setEditing(null);setMessage("Fuente guardada correctamente.");router.refresh();
  }catch(e){setMessage(e instanceof Error?e.message:"Error al guardar");}
  finally{setBusy(false);}
 }
 const setField=<K extends keyof Form,>(key:K,value:Form[K])=>setForm(previous=>({...previous,[key]:value}));
 return <div className="space-y-4">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <p className="text-sm text-slate-600">{sources.length} fuentes registradas. Las fuentes manuales se conservan en el catálogo, pero aún no cuentan con rastreo automático.</p>
   {canEdit&&<button className="button-primary" type="button" onClick={()=>start()}>+ Nueva fuente</button>}
  </div>
  {message&&<p role="status" className="rounded-md bg-slate-100 p-3 text-sm">{message}</p>}
  {open&&canEdit&&<form onSubmit={save} className="card space-y-4 p-5">
    <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{editing?"Editar fuente":"Registrar fuente oficial"}</h2><button type="button" onClick={()=>setOpen(false)} className="underline">Cerrar</button></div>
    <div className="grid gap-4 md:grid-cols-2">
     <label className="text-sm">Nombre<input className="mt-1 w-full rounded border p-2" required maxLength={200} value={form.name} onChange={e=>setField("name",e.target.value)}/></label>
     <label className="text-sm">País<input className="mt-1 w-full rounded border p-2" required maxLength={100} value={form.country} onChange={e=>setField("country",e.target.value)}/></label>
     <label className="text-sm">Categoría<input className="mt-1 w-full rounded border p-2" required maxLength={120} value={form.category} onChange={e=>setField("category",e.target.value)}/></label>
     <label className="text-sm">Frecuencia deseada<select className="mt-1 w-full rounded border p-2" value={form.frequency} onChange={e=>setField("frequency",e.target.value as Frequency)}>
      <option value="manual">Manual</option><option value="daily">Diaria</option><option value="weekly">Semanal</option>
     </select></label>
     <label className="text-sm md:col-span-2">URL oficial HTTPS<input className="mt-1 w-full rounded border p-2" required type="url" maxLength={2048} value={form.official_url} onChange={e=>setField("official_url",e.target.value)} placeholder="https://..." /></label>
     <label className="text-sm">Método de consulta<select className="mt-1 w-full rounded border p-2" value={form.query_method} onChange={e=>setField("query_method",e.target.value as Method)}>
      <option value="manual">Manual / sin adaptador</option><option value="socrata">SECOP II — adaptador Socrata</option><option value="pncp">Brasil — PNCP (API)</option><option value="ted">Unión Europea — TED (API)</option><option value="sercop">Ecuador — SERCOP OCDS (API)</option>
     </select></label>
     <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.enabled} onChange={e=>setField("enabled",e.target.checked)}/> Fuente habilitada</label>
    </div>
    <p className="text-xs text-slate-600">El adaptador Socrata solo admite la URL oficial del conjunto SECOP II: <code className="break-all">{secopOfficialUrl}</code>. PNCP solamente admite https://pncp.gov.br/app/editais. La frecuencia es una preferencia de catálogo; no crea por sí sola una ejecución programada.</p>
    <button className="button-primary disabled:opacity-50" disabled={busy} type="submit">{busy?"Guardando…":editing?"Guardar cambios":"Crear fuente"}</button>
   </form>}
  <div className="card overflow-x-auto p-4">
   <table className="w-full min-w-[960px] text-left text-sm"><thead><tr>{["Fuente","País / categoría","URL oficial","Consulta","Frecuencia","Estado","Última consulta",...(canEdit?["Acciones"]:[])].map(x=><th key={x} className="border-b p-2">{x}</th>)}</tr></thead>
   <tbody>{sources.map(source=><tr className="border-b" key={source.id}>
    <td className="p-2 font-medium">{source.name}</td><td className="p-2">{source.country}<p className="text-xs text-slate-500">{source.category}</p></td>
    <td className="max-w-60 break-all p-2"><a className="text-teal-800 underline" href={source.official_url} target="_blank" rel="noopener noreferrer">Abrir sitio ↗</a></td>
    <td className="p-2">{source.query_method==="socrata"?"SECOP II automático":source.query_method==="pncp"?"Brasil PNCP automático":source.query_method==="ted"?"TED Unión Europea automático":source.query_method==="sercop"?"Ecuador SERCOP API":"Sin adaptador"}</td>
    <td className="p-2">{source.frequency==="daily"?"Diaria":source.frequency==="weekly"?"Semanal":"Manual"}</td>
    <td className="p-2"><span className={source.enabled?"text-emerald-800":"text-slate-500"}>{source.enabled?"Habilitada":"Deshabilitada"}</span><p className="text-xs text-slate-500">{source.technical_status}</p></td>
    <td className="p-2">{source.last_checked_at?source.last_checked_at.slice(0,16).replace("T"," ")+" UTC":"Sin consultar"}</td>
    {canEdit&&<td className="p-2"><button className="text-teal-800 underline" type="button" onClick={()=>start(source)}>Editar</button></td>}
   </tr>)}</tbody>
   </table>
  </div>
 </div>;
}
