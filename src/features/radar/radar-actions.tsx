"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
export function RadarActions({canRun}:{canRun:boolean}) {
 const router=useRouter();
 const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");
 async function act(path:string) {
  setBusy(true);setMessage("");
  try {
   const response=await fetch(path,{method:"POST",headers:{"Content-Type":"application/json"}});
   const result=await response.json();
   if(!response.ok) throw Error(result.error||"Error de ejecución");
   setMessage(path.endsWith("/run")?`Fuentes consultadas: ${result.checked}. Nuevos candidatos: ${result.discovered}. Verificadas: ${result.verified}.`:`Catálogo inicializado: ${result.sources} fuentes y ${result.services} líneas de servicio.`);
   router.refresh();
  } catch(e) {setMessage(e instanceof Error?e.message:"No se completó la acción");}
  finally{setBusy(false);}
 }
 if(!canRun) return <p className="text-sm text-slate-500">Tu rol permite consultar el Radar, pero no ejecutar búsquedas.</p>;
 return <div className="flex flex-wrap items-center gap-3">
  <button disabled={busy} className="button-primary disabled:opacity-50" onClick={()=>act("/api/radar/seed")}>Inicializar fuentes</button>
  <button disabled={busy} className="button-primary disabled:opacity-50" onClick={()=>act("/api/radar/run")}>{busy?"Ejecutando…":"Buscar ahora"}</button>
  <p role="status" className="text-sm text-slate-600">{message}</p>
 </div>;
}
