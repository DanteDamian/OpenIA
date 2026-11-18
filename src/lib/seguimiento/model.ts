import {validUuid} from "@/lib/auth/validation";
import {validDate} from "@/lib/business/validation";

export type HourEntryForm={
 project_id:string;work_item_id:string|null;activity_date:string;consultant_name:string;
 description:string;hours:string
};
export function hourInput(value:unknown):HourEntryForm|null{
 if(!value||typeof value!=="object"||Array.isArray(value))return null;
 const row=value as Record<string,unknown>;
 if(Object.keys(row).some(key=>!["project_id","work_item_id","activity_date","consultant_name","description","hours"].includes(key)))return null;
 if(!validUuid(row.project_id)||!validDate(String(row.activity_date||"")))return null;
 const workItem=row.work_item_id===null||row.work_item_id===""?null:row.work_item_id;
 if(workItem!==null&&!validUuid(workItem))return null;
 if(typeof row.consultant_name!=="string"||typeof row.description!=="string"||typeof row.hours!=="string")return null;
 const consultant=row.consultant_name.trim(),description=row.description.trim(),hours=row.hours.trim();
 if(consultant.length<2||consultant.length>160||description.length<4||description.length>2000)return null;
 if(!/^(?:0?\.\d{1,2}|\d{1,2}(?:\.\d{1,2})?)$/.test(hours))return null;
 const amount=Number(hours);
 if(amount<=0||amount>24)return null;
 return {project_id:row.project_id,work_item_id:workItem,activity_date:row.activity_date as string,
  consultant_name:consultant,description,hours};
}
export function budgetInput(value:unknown):{project_id:string;contracted_hours:string|null;notes:string|null}|null{
 if(!value||typeof value!=="object"||Array.isArray(value))return null;
 const row=value as Record<string,unknown>;
 if(Object.keys(row).some(x=>!["project_id","contracted_hours","notes"].includes(x)))return null;
 if(!validUuid(row.project_id)||typeof row.notes!=="string"||row.notes.length>1000)return null;
 const valueHours=row.contracted_hours;
 if(valueHours!==null&&typeof valueHours!=="string")return null;
 const hours=valueHours===null||valueHours.trim()===""?null:valueHours.trim();
 if(hours!==null&&(!/^\d{1,8}(?:\.\d{1,2})?$/.test(hours)||Number(hours)>99999999.99))return null;
 return {project_id:row.project_id,contracted_hours:hours,notes:row.notes.trim()||null};
}
export function actPeriod(value:unknown):{project_id:string;from:string;to:string}|null{
 if(!value||typeof value!=="object"||Array.isArray(value))return null;
 const row=value as Record<string,unknown>;
 if(Object.keys(row).some(x=>!["project_id","from","to"].includes(x)))return null;
 if(!validUuid(row.project_id)||typeof row.from!=="string"||typeof row.to!=="string")return null;
 if(!validDate(row.from)||!validDate(row.to)||row.from>row.to)return null;
 return {project_id:row.project_id,from:row.from,to:row.to};
}
export function fmtHours(value:unknown){
 const n=Number(value);
 return Number.isFinite(n)?new Intl.NumberFormat("es-CO",{minimumFractionDigits:2,maximumFractionDigits:2}).format(n):"0,00";
}
