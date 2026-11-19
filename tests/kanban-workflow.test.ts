import {describe,it,expect} from "vitest";
import {kanbanColumns,kanbanTransition,boardCounts,overdue} from "@/lib/kanban/model";
const id="8ab93ad5-413c-4df5-a6c0-a86dfed51895";
const projectId="2ab93ad5-413c-4df5-a6c0-a86dfed51895";
describe("Kanban de actividades existentes",()=>{
 it("maps exactly the three already persisted workflow statuses",()=>{
  expect(kanbanColumns.map(c=>c.status)).toEqual(["pending","in_progress","done"]);
  expect(kanbanColumns.map(c=>c.name)).toEqual(["Por hacer","En ejecución","Terminadas"]);
 });
 it("accepts valid project-scoped transitions and archived work",()=>{
  expect(kanbanTransition({id,projectId,from:"pending",to:"in_progress"})).toEqual({
    id,projectId,from:"pending",to:"in_progress"
  });
  expect(kanbanTransition({id,projectId,from:"cancelled",to:"pending"})?.to).toBe("pending");
  expect(kanbanTransition({id,projectId,from:"done",to:"pending"})?.to).toBe("pending");
 });
 it("rejects unknown fields, illegal status, identical transitions and invalid project ids",()=>{
  expect(kanbanTransition({id,projectId,from:"done",to:"done"})).toBeNull();
  expect(kanbanTransition({id,projectId,from:"todo",to:"in_progress"})).toBeNull();
  expect(kanbanTransition({id,projectId:"bad",from:"pending",to:"done"})).toBeNull();
  expect(kanbanTransition({id,projectId,from:"pending",to:"done",organization_id:projectId})).toBeNull();
  expect(kanbanTransition({id,projectId,from:"pending",to:"done",hours:20})).toBeNull();
 });
 it("calculates WIP and completion without counting cancelled as completed",()=>{
  expect(boardCounts([{status:"pending"},{status:"in_progress"},{status:"done"},{status:"cancelled"}])).toEqual({
    pending:1,in_progress:1,done:1,cancelled:1
  });
  expect(overdue({due_on:"2026-11-01",status:"in_progress"},"2026-11-18")).toBe(true);
  expect(overdue({due_on:"2026-11-01",status:"done"},"2026-11-18")).toBe(false);
  expect(overdue({due_on:null,status:"pending"},"2026-11-18")).toBe(false);
 });
});
