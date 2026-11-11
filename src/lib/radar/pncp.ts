import {topicPattern} from "./sources";
import {suggestedService} from "./secop-details";
const trim=(value:unknown,max=1500)=>typeof value==="string"?value.trim().slice(0,max):"";
const date=(v:unknown)=>{const x=trim(v,40).slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(x)?x:null;};
export const pncpOfficialUrl="https://pncp.gov.br/app/editais";
export const pncpApiEndpoint="https://pncp.gov.br/api/consulta/v1/contratacoes/proposta";
export type ExternalCandidate={
 official_id:string;title:string;description:string;issuer_name:string|null;country:string;
 opportunity_type:string;official_url:string;normalized_url:string;
 published_on:string|null;deadline_on:string|null;budget:number|null;currency:string|null;
 service_name:string|null;match_score:number;match_reason:string;
};
function safeBudget(v:unknown):number|null {
 const number=typeof v==="number"?v:typeof v==="string"&&v.trim()?Number(v):NaN;
 return Number.isFinite(number)&&number>=0&&number<=9999999999999999?number:null;
}
/** Official PNCP control id of the form CNPJ-YYYY-sequence. Links are derived only from
 * validated source-owned identifiers; no arbitrary source URL is fetched. */
export function pncpCandidate(value:unknown,today:string):ExternalCandidate|null {
 if(!value||typeof value!=="object"||Array.isArray(value))return null;
 const row=value as Record<string,unknown>;
 const id=trim(row.numeroControlePNCP,90);
 const match=id.match(/^(\d{14})-(\d{4})-(\d{1,12})$/);
 if(!match)return null;
 const description=trim(row.objetoCompra,2000);
 if(!description||!topicPattern.test(description))return null;
 const published=date(row.dataPublicacaoPncp);
 const deadline=date(row.dataEncerramentoProposta);
 if(!published||!deadline||deadline<today)return null;
 const url=`https://pncp.gov.br/app/editais/${match[1]}/${match[2]}/${Number(match[3])}`;
 const org=row.orgaoEntidade;
 const issuer=org&&typeof org==="object"&&!Array.isArray(org)?trim((org as Record<string,unknown>).razaoSocial,200):"";
 return {official_id:id,title:description.slice(0,300),description,issuer_name:issuer||null,country:"Brasil",
  opportunity_type:"Contratación pública",official_url:url,normalized_url:url,
  published_on:published,deadline_on:deadline,budget:safeBudget(row.valorTotalEstimado),currency:"BRL",
  service_name:suggestedService(description,""),match_score:50,match_reason:"Coincidencia temática y país; elegibilidad jurídica y financiera no verificadas."};
}
export async function fetchPncp(now:Date=new Date()):Promise<ExternalCandidate[]> {
 const dateFinal=new Date(now.getTime()+90*86400_000).toISOString().slice(0,10).replaceAll("-","");
 const today=now.toISOString().slice(0,10);
 const candidates:ExternalCandidate[]=[];
 // Official API requires one modality per request. Bound both the modalities and response size.
 const pages=await Promise.all([4,6,8].map(async modality => {
  const url=new URL(pncpApiEndpoint);
  url.searchParams.set("dataFinal",dateFinal);
  url.searchParams.set("codigoModalidadeContratacao",String(modality));
  url.searchParams.set("pagina","1");url.searchParams.set("tamanhoPagina","20");
  const response=await fetch(url,{method:"GET",headers:{Accept:"application/json"},signal:AbortSignal.timeout(8000),cache:"no-store",redirect:"error"});
  if(!response.ok)throw new Error(`PNCP HTTP ${response.status}`);
  const payload:unknown=await response.json();
  if(!payload||typeof payload!=="object"||Array.isArray(payload))throw Error("Formato PNCP inesperado");
  const records=(payload as {data?:unknown}).data;
  if(!Array.isArray(records))throw Error("Resultados PNCP inválidos");
  return records.slice(0,20);
 }));
 for(const page of pages)for(const row of page){
  const item=pncpCandidate(row,today);
  if(item&&!candidates.some(v=>v.official_id===item.official_id))candidates.push(item);
 }
 return candidates.slice(0,20);
}
