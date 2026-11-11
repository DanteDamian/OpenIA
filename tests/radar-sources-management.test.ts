import {describe,expect,it} from "vitest";
import {isPublicSourceUrl,sourceInput,secopAdapterUrl} from "@/lib/radar/source-validation";
const sample={name:"SERCOP",country:"Ecuador",category:"Contratación",official_url:"https://portal.compraspublicas.gob.ec/",query_method:"manual",frequency:"weekly",enabled:true};
describe("Radar source management validation",()=>{
 it("allows reviewed editable metadata and manual sources",()=>{
  expect(sourceInput(sample)).toEqual(sample);
  expect(sourceInput({...sample,name:" SERCOP Ecuador "})?.name).toBe("SERCOP Ecuador");
 });
 it("accepts only canonical official SECOP II URL for automatic connector",()=>{
  expect(sourceInput({...sample,query_method:"socrata",official_url:secopAdapterUrl,frequency:"daily"})).not.toBeNull();
  expect(sourceInput({...sample,query_method:"socrata"})).toBeNull();
  expect(sourceInput({...sample,query_method:"socrata",official_url:"https://127.0.0.1/"})).toBeNull();
 });
 it("blocks private/unsafe URLs, extra fields, invalid cadence and arbitrary types",()=>{
  for(const url of ["http://example.com","https://localhost/","https://127.0.0.1/","https://[::1]/","https://admin:pass@foo.example/","https://test.local/","javascript:alert(1)"])
   expect(isPublicSourceUrl(url)).toBe(false);
  expect(sourceInput({...sample,frequency:"hourly"})).toBeNull();
  expect(sourceInput({...sample,enabled:"true"})).toBeNull();
  expect(sourceInput({...sample,organization_id:"other"})).toBeNull();
  expect(sourceInput({...sample,name:""})).toBeNull();
 });
});
