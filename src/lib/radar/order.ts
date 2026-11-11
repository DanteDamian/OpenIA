export const radarOrderColumns=[
 {field:"title",label:"Convocatoria y objeto"},
 {field:"country",label:"País"},
 {field:"published_on",label:"Publicación"},
 {field:"deadline_on",label:"Vencimiento"},
 {field:"budget",label:"Presupuesto base"},
 {field:"duration_value",label:"Duración estimada"},
 {field:"service_name",label:"Servicio AIGENTERRA posible"},
 {field:"match_score",label:"Compatibilidad"},
 {field:"verification_status",label:"Verificación"},
 {field:"source_name",label:"Fuente / proceso específico"}
] as const;
export type RadarOrderField=(typeof radarOrderColumns)[number]["field"];
export type RadarOrderDirection="asc"|"desc";
type Item={title:string;country:string;published_on:string|null;deadline_on:string|null;budget:number|null;duration_value:number|null;service_name:string|null;match_score:number|null;verification_status:string;source_id:string};
export function parseRadarOrder(params:Record<string,string|string[]|undefined>){
 const value=params.sort;
 const sort=radarOrderColumns.find(x=>x.field===value)?.field||"published_on";
 return {sort,direction:params.direction==="asc"?"asc" as const:"desc" as const};
}
export function orderRadar<T extends Item>(items:readonly T[],sources:readonly {id:string;name:string}[],sort:RadarOrderField,direction:RadarOrderDirection):T[]{
 const names=new Map(sources.map(s=>[s.id,s.name]));
 const get=(row:T):string|number|null=>{
  if(sort==="source_name")return names.get(row.source_id)||null;
  return row[sort];
 };
 const compare=(a:T,b:T)=>{
  const left=get(a),right=get(b);
  if(left===null||left===undefined||left==="")return right===null||right===undefined||right===""?0:1;
  if(right===null||right===undefined||right==="")return -1;
  const order=typeof left==="number"&&typeof right==="number"?left-right:String(left).localeCompare(String(right),"es",{sensitivity:"base",numeric:true});
  return direction==="asc"?order:-order;
 };
 return [...items].sort((a,b)=>compare(a,b)||a.title.localeCompare(b.title,"es"));
}
