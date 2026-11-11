import {describe,it,expect} from "vitest";
import {directSecopUrl,secopBudget,secopDuration,suggestedService} from "@/lib/radar/secop-details";
describe("SECOP II: detail enrichment",()=>{
 it("uses the official individual opportunity URL, never generic dataset or invented noticeUID",()=>{
  const url="https://community.secop.gov.co/Public/Tendering/OpportunityDetail/Index?noticeUID=CO1.NTC.9042868";
  expect(directSecopUrl({url})).toBe(url);
  expect(directSecopUrl(url)).toBe(url);
  expect(directSecopUrl("https://www.datos.gov.co/resource/p6dx-8zbt.json")).toBeNull();
  expect(directSecopUrl("https://evil.example/Public/Tendering/OpportunityDetail/Index?noticeUID=CO1.NTC.9042868")).toBeNull();
  expect(directSecopUrl("javascript:alert(1)")).toBeNull();
  expect(directSecopUrl({url:"https://community.secop.gov.co/Public/Tendering/OpportunityDetail/Index?noticeUID=wrong"})).toBeNull();
 });
 it("only reports source-provided numeric values and duration",()=>{
  expect(secopBudget({precio_base:"1200000"})).toBe(1200000);
  expect(secopBudget({precio_base:null})).toBeNull();
  expect(secopBudget({precio_base:"not-a-number"})).toBeNull();
  expect(secopDuration({duracion:"12",unidad_de_duracion:"Mes(es)"})).toEqual({value:12,unit:"Mes(es)"});
  expect(secopDuration({duracion:0,unidad_de_duracion:"Mes(es)"})).toEqual({value:null,unit:null});
 });
 it("suggests only registered AIGENTERRA services from source content",()=>{
  expect(suggestedService("Implementar un SIG","cartografía catastral")).toBe("Sistemas de información geográfica");
  expect(suggestedService("Boletín","Servicios generales")).toBeNull();
 });
});
