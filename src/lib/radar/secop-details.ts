import {aigenterraServices} from "./sources";

const clean = (value:unknown, limit=1500) => typeof value==="string" ? value.trim().slice(0,limit) : "";
export function directSecopUrl(value:unknown):string|null {
 const raw=typeof value==="object" && value!==null && "url" in value ? (value as {url:unknown}).url : value;
 const text=clean(raw,2048);
 try {
  const url=new URL(text);
  if(url.protocol!=="https:" || url.hostname!=="community.secop.gov.co")return null;
  if(!/^\/Public\/Tendering\/(OpportunityDetail\/Index|Opportunity\/Detail\/Index)$/i.test(url.pathname))return null;
  if(!/^CO1\.NTC\.\d+$/.test(url.searchParams.get("noticeUID")||""))return null;
  return url.toString();
 }catch{return null;}
}
export function secopBudget(row:Record<string,unknown>):number|null {
 const raw=row.precio_base;
 if(raw===undefined || raw===null || raw==="")return null;
 const n=typeof raw==="number"?raw:Number(raw);
 return Number.isFinite(n)&&n>=0&&n<=9999999999999999?n:null;
}
export function secopDuration(row:Record<string,unknown>):{value:number|null;unit:string|null} {
 const raw=row.duracion;
 const n=typeof raw==="number"?raw:Number(raw);
 const value=raw!==undefined&&raw!==null&&raw!==""&&Number.isSafeInteger(n)&&n>0?n:null;
 const unit=clean(row.unidad_de_duracion,60);
 return {value,unit:value&&unit?unit:null};
}
const serviceRules:readonly {pattern:RegExp;name:string}[]=[
 {pattern:/geoespacial|informaci[oó]n geogr[aá]fica|cartograf|\bgis\b|\bsig\b/i,name:"Sistemas de información geográfica"},
 {pattern:/sat[eé]lit|teledete|remote sensing|im[aá]gen(es)? espaciales/i,name:"Analítica de imágenes satelitales"},
 {pattern:/cambio(s)? de cobertura|deforest|cobertura vegetal/i,name:"Detección de cambios y coberturas"},
 {pattern:/monitoreo ambiental|seguimiento ambiental|forestal|ecosistema/i,name:"Monitoreo ambiental"},
 {pattern:/vulnerabil|riesgo|amenaza|deslizamiento/i,name:"Riesgo y vulnerabilidad"},
 {pattern:/\bgeoai\b|inteligencia artificial|machine learning|aprendizaje autom[aá]tico/i,name:"GeoAI e inteligencia artificial geoespacial"},
 {pattern:/automatiza|\bsaas\b|plataforma(s)? web/i,name:"Automatización y plataformas SaaS"},
 {pattern:/dashboard|tablero|inteligencia territorial/i,name:"Dashboards e inteligencia territorial"},
 {pattern:/integraci[oó]n de datos|procesamiento de datos geoespaciales/i,name:"Integración y procesamiento de datos geoespaciales"}
];
export function suggestedService(title:string,description:string):string|null {
 const text=(title+" "+description).slice(0,3000);
 const candidate=serviceRules.find(rule=>rule.pattern.test(text))?.name;
 return candidate && (aigenterraServices as readonly string[]).includes(candidate)?candidate:null;
}
export function safeOfficialProcessLink(url:string|null|undefined):string|null {
 return directSecopUrl(url);
}
