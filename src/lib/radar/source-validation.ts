import {sourceSeeds} from "./sources";
export type SourceFrequency="daily"|"weekly"|"manual";
export type SourceMethod="manual"|"socrata"|"pncp";
export type SourceForm={name:string;official_url:string;country:string;category:string;query_method:SourceMethod;frequency:SourceFrequency;enabled:boolean};
const apiUrl=sourceSeeds.find(item=>item.query_method==="socrata")!.official_url;
export const pncpSourceUrl="https://pncp.gov.br/app/editais";
function text(input:unknown,max:number):string|null {
 if(typeof input!=="string")return null;
 const value=input.trim();
 return value.length>0&&value.length<=max?value:null;
}
export function isPublicSourceUrl(input:unknown):input is string {
 if(typeof input!=="string"||input.length>2048||!input)return false;
 try {
  const url=new URL(input);
  const hostname=url.hostname.toLowerCase();
  if(url.protocol!=="https:"||url.username||url.password||url.port||url.hash)return false;
  if(hostname==="localhost"||hostname.endsWith(".localhost")||hostname.endsWith(".local")||hostname.endsWith(".internal"))return false;
  if(/^\d+(?:\.\d+){3}$/.test(hostname)||hostname.includes(":"))return false;
  if(!hostname.includes(".")||!/^[-a-z0-9.]+$/.test(hostname))return false;
  return !url.pathname.includes("..");
 }catch{return false;}
}
/** Only the reviewed SECOP dataset has a real adapter. A catalog edit cannot attach a generic
 * remote host to the fixed SECOP connector (nor silently make unsupported sources searchable). */
export function sourceInput(value:unknown):SourceForm|null {
 if(!value||typeof value!=="object"||Array.isArray(value))return null;
 const raw=value as Record<string,unknown>;
 const fields=["name","official_url","country","category","query_method","frequency","enabled"];
 if(Object.keys(raw).some(k=>!fields.includes(k)))return null;
 const name=text(raw.name,200),country=text(raw.country,100),category=text(raw.category,120);
 if(!name||!country||!category||!isPublicSourceUrl(raw.official_url))return null;
 if(raw.query_method!=="manual"&&raw.query_method!=="socrata"&&raw.query_method!=="pncp")return null;
 if(!["daily","weekly","manual"].includes(String(raw.frequency)))return null;
 if(typeof raw.enabled!=="boolean")return null;
 if(raw.query_method==="socrata"&&raw.official_url!==apiUrl)return null;
 if(raw.query_method==="pncp"&&raw.official_url!==pncpSourceUrl)return null;
 if(raw.query_method==="manual"&&raw.enabled) {
  // Enabled manual sources are catalogued but not automatically scraped.
 }
 return {name,official_url:raw.official_url,country,category,query_method:raw.query_method,
  frequency:raw.frequency as SourceFrequency,enabled:raw.enabled};
}
export const secopAdapterUrl=apiUrl;
