import { getAccess } from "@/lib/auth/session";
import { sameOrigin } from "@/lib/auth/validation";
import { boundedJson,json } from "@/lib/auth/http";
export async function PATCH(request:Request) {
  if(!sameOrigin(request)) return json({error:"Origen no autorizado."},403);
  const access=await getAccess();
  if(access.status!=="authorized") return json({error:"Sesión no autorizada."},401);
  if(access.role!=="admin") return json({error:"Solo administradores pueden editar la empresa."},403);
  const raw=await boundedJson(request);
  if(!raw || typeof raw!=="object" || Array.isArray(raw)) return json({error:"Datos inválidos."},400);
  const input=raw as Record<string,unknown>; const limits:Record<string,number>={name:200,tax_id:40,email:254,phone:40,address:1000};
  if(Object.keys(input).some(key=>!Object.hasOwn(limits,key))) return json({error:"Campos no autorizados."},400);
  const values:Record<string,string|null>={};
  for(const [key,max] of Object.entries(limits)) {
    if(input[key]!==null && typeof input[key]!=="string") return json({error:"Datos inválidos."},400);
    const text=typeof input[key]==="string" ? input[key].trim() : "";
    if(text.length>max || (key==="name"&&!text) || (key==="email"&&text&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text))) return json({error:"Datos inválidos."},400);
    values[key]=text||null;
  }
  const {data,error}=await access.supabase.from("organizations").update(values).eq("id",access.organizationId).select("id").maybeSingle();
  if(error) return json({error:"No fue posible actualizar la empresa."},400);
  return data ? json({success:true}) : json({error:"Empresa no disponible."},404);
}
