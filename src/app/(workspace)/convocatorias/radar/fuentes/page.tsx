import Link from "next/link";
import {requireAccess} from "@/lib/auth/session";
import {SourceCatalog} from "@/features/radar/source-catalog";
export const dynamic="force-dynamic";
export default async function FuentesRadar(){
 const access=await requireAccess();
 const {data,error}=await access.supabase.from("radar_sources")
  .select("id,name,official_url,country,category,query_method,frequency,enabled,technical_status,last_checked_at,last_result")
  .eq("organization_id",access.organizationId).order("country").order("name").limit(300);
 return <main className="space-y-5">
  <p className="eyebrow">CONVOCATORIAS / RADAR GEOIA</p>
  <div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-semibold">Catálogo de fuentes</h1>
   <p className="mt-2 text-slate-600">Administra los sitios oficiales consultados por el Radar y las fuentes de seguimiento manual.</p></div>
   <Link className="text-teal-800 underline" href="/convocatorias/radar">Volver al Radar</Link>
  </div>
  {error?<p className="card p-4 text-red-700" role="alert">No se pudo obtener el catálogo de fuentes.</p>:
    <SourceCatalog sources={data||[]} canEdit={["admin","manager"].includes(access.role)}/>}
 </main>;
}
