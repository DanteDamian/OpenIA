import { getAccess } from "@/lib/auth/session";
import { sameOrigin } from "@/lib/auth/validation";
import { sourceSeeds, aigenterraServices } from "@/lib/radar/sources";
import { NextResponse } from "next/server";
export async function POST(request:Request) {
 if(!sameOrigin(request)) return NextResponse.json({error:"Origen no autorizado"},{status:403});
 const a=await getAccess();
 if(a.status!=="authorized") return NextResponse.json({error:"Sin acceso"},{status:403});
 if(!["admin","manager"].includes(a.role)) return NextResponse.json({error:"Permiso insuficiente"},{status:403});
 const org=a.organizationId;
 const sources=sourceSeeds.map(s=>({...s,organization_id:org}));
 const {error:sourceError}=await a.supabase.from("radar_sources").upsert(sources,{onConflict:"organization_id,official_url",ignoreDuplicates:true});
 if(sourceError) return NextResponse.json({error:"No se pudieron preparar las fuentes"},{status:503});
 const services=aigenterraServices.map(name=>({organization_id:org,name,category:"Portafolio por validar"}));
 const {error:serviceError}=await a.supabase.from("radar_services").upsert(services,{onConflict:"organization_id,name",ignoreDuplicates:true});
 if(serviceError) return NextResponse.json({error:"No se pudo preparar el catálogo"},{status:503});
 return NextResponse.json({sources:sources.length,services:services.length});
}
