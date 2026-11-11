import {getAccess} from "@/lib/auth/session";
import {sameOrigin,validUuid} from "@/lib/auth/validation";
import {boundedJson,json} from "@/lib/auth/http";
import {sourceInput} from "@/lib/radar/source-validation";
function duplicate(error:{code?:string}):boolean{return error.code==="23505";}
async function save(request:Request,editing:boolean) {
 if(!sameOrigin(request))return json({error:"Origen no autorizado."},403);
 const access=await getAccess();
 if(access.status!=="authorized")return json({error:"No autenticado."},401);
 if(!["admin","manager"].includes(access.role))return json({error:"Permisos insuficientes."},403);
 const id=new URL(request.url).searchParams.get("id");
 if(editing&&!validUuid(id))return json({error:"ID de fuente inválido."},400);
 const input=sourceInput(await boundedJson(request));
 if(!input)return json({error:"Revisa la fuente: URL pública HTTPS y método automático solo para SECOP II autorizado."},400);
 // Only owned rows are changed; no deletions or changes to linked opportunities.
 const query=editing
  ?access.supabase.from("radar_sources").update(input).eq("organization_id",access.organizationId).eq("id",id!)
  :access.supabase.from("radar_sources").insert({...input,organization_id:access.organizationId});
 const {data,error}=await query.select("id").maybeSingle();
 if(error)return json({error:duplicate(error)?"Ya existe una fuente con esta URL.":"No fue posible guardar la fuente."},duplicate(error)?409:400);
 if(!data)return json({error:"Fuente no encontrada en la empresa."},404);
 return json({id:data.id},editing?200:201);
}
export async function POST(request:Request){return save(request,false);}
export async function PATCH(request:Request){return save(request,true);}
