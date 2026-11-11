import {describe,expect,it} from "vitest";
import {orderRadar,parseRadarOrder,radarOrderColumns} from "@/lib/radar/order";
const row=(title:string,extra:Record<string,unknown>={})=>({
 title,country:"Colombia",published_on:"2026-11-10",deadline_on:null,budget:null,duration_value:null,
 service_name:null,match_score:null,verification_status:"Pendiente",source_id:"a",...extra
});
const sources=[{id:"a",name:"SECOP"},{id:"b",name:"TED"}];
describe("Radar sortable opportunity table",()=>{
 it("exposes every visible column and restricts URL sort keys",()=>{
  expect(radarOrderColumns).toHaveLength(10);
  expect(parseRadarOrder({sort:"match_score",direction:"asc"})).toEqual({sort:"match_score",direction:"asc"});
  expect(parseRadarOrder({sort:"injection",direction:"bad"})).toEqual({sort:"published_on",direction:"desc"});
 });
 it("sorts numeric values, dates and source names",()=>{
  const rows=[row("A",{budget:100,match_score:85,source_id:"b",published_on:"2026-11-09"}),
              row("B",{budget:200,match_score:25,source_id:"a",published_on:"2026-11-11"})];
  expect(orderRadar(rows,sources,"budget","desc").map(x=>x.title)).toEqual(["B","A"]);
  expect(orderRadar(rows,sources,"match_score","desc").map(x=>x.title)).toEqual(["A","B"]);
  expect(orderRadar(rows,sources,"published_on","asc").map(x=>x.title)).toEqual(["A","B"]);
  expect(orderRadar(rows,sources,"source_name","asc").map(x=>x.title)).toEqual(["B","A"]);
 });
 it("places missing data last in both directions without mutating records",()=>{
  const rows=[row("A",{budget:null}),row("B",{budget:0})];
  expect(orderRadar(rows,sources,"budget","asc").map(x=>x.title)).toEqual(["B","A"]);
  expect(orderRadar(rows,sources,"budget","desc").map(x=>x.title)).toEqual(["B","A"]);
  expect(rows[0].title).toBe("A");
 });
});
