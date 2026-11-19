import {describe,it,expect} from "vitest";
import {resources} from "@/lib/business/model";
import {businessInput} from "@/lib/business/validation";
const project="8ab93ad5-413c-4df5-a6c0-a86dfed51895";
const member="2ab93ad5-413c-4df5-a6c0-a86dfed51895";
const fields={project_id:project,kind:"activity",title:"Control de calidad SIG",
  description:"Validación de datos",status:"pending",assignee_id:member,due_on:"2026-11-30"};
describe("Responsable de actividades",()=>{
 it("uses a relation with active company users, not a free-text UUID entry",()=>{
  expect(resources.actividades.fields.find(field=>field.name==="assignee_id")).toMatchObject({
    name:"assignee_id",label:"Responsable",relation:"organization_memberships",type:"uuid"
  });
 });
 it("saves the chosen UUID without changing existing activity fields",()=>{
  expect(businessInput("actividades",fields)).toMatchObject(fields);
  expect(businessInput("actividades",{...fields,assignee_id:"Texto no válido"})).toBeNull();
  expect(businessInput("actividades",{...fields,assignee_id:""})).toMatchObject({assignee_id:null});
 });
});
