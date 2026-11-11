import {topicPattern} from "./sources";
import {suggestedService} from "./secop-details";
import type {ExternalCandidate} from "./pncp";
export const sercopSourceUrl="https://portal.compraspublicas.gob.ec/";
export const sercopEndpoint="https://datosabiertos.compraspublicas.gob.ec/PLATAFORMA/api/search_ocds";
const clean=(v:unknown,n=2000)=>typeof v==="string"?v.trim().slice(0,n):"";
const date=(v:unknown)=>{const x=clean(v,30).slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(x)?x:null;};
export function sercopCandidate(v:unknown):ExternalCandidate|null {
 if(!v||typeof v!=="object"||Array.isArray(v))return null;
 const row=v as Record<string,unknown>;
 const ocid=clean(row.ocid,160);
 if(!/^ocds-[A-Za-z0-9]{6}-[A-Za-z0-9._-]{5,140}$/.test(ocid))return null;
 const description=clean(row.description);
 if(!description||!topicPattern.test(description))return null;
 const title=clean(row.title,300)||description.slice(0,300);
 const url=new URL("https://datosabiertos.compraspublicas.gob.ec/PLATAFORMA/api/record");
 url.searchParams.set("ocid",ocid);
 return {official_id:ocid,title,description,country:"Ecuador",issuer_name:clean(row.buyerName,180)||null,
  opportunity_type:"Procedimiento OCDS SERCOP",official_url:url.toString(),normalized_url:url.toString(),
  published_on:date(row.date),deadline_on:null,budget:null,currency:null,service_name:suggestedService(title,description),
  match_score:35,match_reason:"Coincidencia temática SERCOP; requiere comprobar que esté abierto y admita una empresa colombiana."};
}
export async function fetchSercop(now:Date=new Date()):Promise<ExternalCandidate[]>{
 const words=["geografica","cartografia","satelital","geoespacial","software"];
 const results=await Promise.allSettled(words.map(async word=>{
  const url=new URL(sercopEndpoint);
  url.searchParams.set("year",String(now.getUTCFullYear()));
  url.searchParams.set("search",word);url.searchParams.set("page","1");
  const response=await fetch(url,{headers:{Accept:"application/json"},signal:AbortSignal.timeout(6500),redirect:"error",cache:"no-store"});
  if(!response.ok)throw Error("SERCOP HTTP "+response.status);
  const payload:unknown=await response.json();
  if(!payload||typeof payload!=="object"||Array.isArray(payload))throw Error("Respuesta SERCOP inválida");
  const data=(payload as {data?:unknown}).data;
  if(!Array.isArray(data))throw Error("SERCOP sin lista de procesos");
  return data.slice(0,25);
 }));
 const successful=results.filter((x):x is PromiseFulfilledResult<unknown[]>=>x.status==="fulfilled");
 if(!successful.length)throw Error("SERCOP no respondió en ninguna búsqueda");
 const found=new Map<string,ExternalCandidate>();
 for(const page of successful)for(const row of page.value){
  const item=sercopCandidate(row);if(item)found.set(item.official_id,item);
 }
 return [...found.values()].slice(0,40);
}
