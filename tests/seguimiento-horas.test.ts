import {describe,it,expect} from "vitest";
import {actPeriod,budgetInput,fmtHours,hourInput} from "@/lib/seguimiento/model";
const project="8ab93ad5-413c-4df5-a6c0-a86dfed51895";
const sample={project_id:project,work_item_id:null,activity_date:"2026-11-18",
 consultant_name:"Daniel Bula",description:"Análisis espacial y control de calidad",hours:"2.50"};
describe("Seguimiento de actividades y horas",()=>{
 it("registra horas positivas y fecha válida por proyecto sin permitir metadatos arbitrarios",()=>{
  expect(hourInput(sample)).toEqual(sample);
  expect(hourInput({...sample,hours:"0"})).toBeNull();
  expect(hourInput({...sample,hours:"24.01"})).toBeNull();
  expect(hourInput({...sample,hours:"0.005"})).toBeNull();
  expect(hourInput({...sample,activity_date:"2026-02-30"})).toBeNull();
  expect(hourInput({...sample,organization_id:project})).toBeNull();
  expect(hourInput({...sample,act_id:project})).toBeNull();
  expect(hourInput({...sample,work_item_id:"not-a-uuid"})).toBeNull();
 });
 it("controla la bolsa de horas sin inventar contratos",()=>{
  expect(budgetInput({project_id:project,contracted_hours:"120.50",notes:"Orden de servicio"})).toEqual({
   project_id:project,contracted_hours:"120.50",notes:"Orden de servicio"
  });
  expect(budgetInput({project_id:project,contracted_hours:null,notes:""})).toEqual({
   project_id:project,contracted_hours:null,notes:null
  });
  expect(budgetInput({project_id:project,contracted_hours:"-1",notes:""})).toBeNull();
 });
 it("valida periodos y presenta horas en dos decimales",()=>{
  expect(actPeriod({project_id:project,from:"2026-11-01",to:"2026-11-30"})).toEqual({
   project_id:project,from:"2026-11-01",to:"2026-11-30"
  });
  expect(actPeriod({project_id:project,from:"2026-12-01",to:"2026-11-30"})).toBeNull();
  expect(fmtHours("3.50")).toMatch(/3,50/);
 });
});
