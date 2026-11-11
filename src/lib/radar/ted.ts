import {topicPattern} from "./sources";
import {suggestedService} from "./secop-details";
import type {ExternalCandidate} from "./pncp";
export const tedSourceUrl="https://ted.europa.eu/es/";
export const tedSearchUrl="https://api.ted.europa.eu/v3/notices/search";
const clean=(x:unknown,limit=2000)=>typeof x==="string"?x.trim().slice(0,limit):"";
function localize(value:unknown):string {
 if(typeof value==="string")return clean(value);
 if(Array.isArray(value))return value.map(localize).find(Boolean)||"";
 if(value&&typeof value==="object"){
  const translations=value as Record<string,unknown>;
  for(const lang of ["eng","spa","por","mul","fra","deu"])if(translations[lang])return localize(translations[lang]);
  return Object.values(translations).map(localize).find(Boolean)||"";
 }
 return "";
}
function date(value:unknown):string|null{
 const d=clean(value,30).slice(0,10);
 return /^\d{4}-\d{2}-\d{2}$/.test(d)?d:null;
}
export function tedCandidate(input:unknown,today:string):ExternalCandidate|null {
 if(!input||typeof input!=="object"||Array.isArray(input))return null;
 const row=input as Record<string,unknown>;
 const id=clean(row["publication-number"],30);
 if(!/^\d{6,8}-\d{4}$/.test(id))return null;
 const title=localize(row["notice-title"]);
 if(!title||!topicPattern.test(title))return null;
 const published=date(row["publication-date"]);
 if(!published)return null;
 // Published in the ACTIVE scope is not a legal guarantee the actual tender is open.
 const deadline=date(row["deadline-receipt-tender-date-lot"]);
 if(deadline&&deadline<today)return null;
 const officialUrl=`https://ted.europa.eu/en/notice/${id}/html`;
 const issuer=localize(row["buyer-name"]);
 return {official_id:id,title:title.slice(0,300),description:title,country:"Unión Europea",
  issuer_name:issuer||null,opportunity_type:"Aviso de contratación TED",official_url:officialUrl,normalized_url:officialUrl,
  published_on:published,deadline_on:deadline,budget:null,currency:null,
  service_name:suggestedService(title,""),match_score:35,
  match_reason:"Coincidencia temática publicada en TED; verificar lotes, plazos y elegibilidad de empresa extranjera."};
}
export async function fetchTed(now:Date=new Date()):Promise<ExternalCandidate[]> {
 const cutoff=new Date(now.getTime()-30*86400_000).toISOString().slice(0,10).replaceAll("-","");
 const today=now.toISOString().slice(0,10);
 const terms=["geospatial","satellite imagery","geographic information"];
 const pages=await Promise.all(terms.map(async(term)=>{
  const response=await fetch(tedSearchUrl,{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},
   body:JSON.stringify({query:`FT~"${term}" AND publication-date>=${cutoff}`,
    fields:["publication-number","publication-date","notice-title","buyer-name","deadline-receipt-tender-date-lot"],
    scope:"ACTIVE",page:1,limit:20,paginationMode:"PAGE_NUMBER"}),
   cache:"no-store",redirect:"error",signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw Error(`TED HTTP ${response.status}`);
  const result:unknown=await response.json();
  if(!result||typeof result!=="object"||Array.isArray(result))throw Error("Respuesta TED inválida");
  const notices=(result as {notices?:unknown}).notices;
  if(!Array.isArray(notices))throw Error("Datos TED inválidos");
  return notices;
 }));
 const found=new Map<string,ExternalCandidate>();
 for(const page of pages)for(const item of page){
  const candidate=tedCandidate(item,today);
  if(candidate)found.set(candidate.official_id,candidate);
 }
 return [...found.values()].slice(0,30);
}
