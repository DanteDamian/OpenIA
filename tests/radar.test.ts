import {describe,it,expect} from "vitest";
import {sourceSeeds,aigenterraServices,topicPattern} from "@/lib/radar/sources";
describe("Radar GeoIA: catálogo e integridad",()=>{
 it("contiene fuentes oficiales prioritarias y referencia colombiana consultable",()=>{
  expect(sourceSeeds.length).toBeGreaterThanOrEqual(15);
  expect(sourceSeeds.some(x=>x.country==="Ecuador")).toBe(true);
  expect(sourceSeeds.some(x=>x.country==="Panamá")).toBe(true);
  expect(sourceSeeds.some(x=>x.name.includes("UNGM"))).toBe(true);
  expect(sourceSeeds.filter(x=>x.query_method==="socrata" && x.enabled)).toHaveLength(1);
 });
 it("no duplica URL ni confunde la fuente con una convocatoria abierta",()=>{
  expect(new Set(sourceSeeds.map(x=>x.official_url)).size).toBe(sourceSeeds.length);
  for(const s of sourceSeeds) expect(s.official_url).toMatch(/^https:\/\//);
  expect(aigenterraServices).not.toContain("Procalculo");
 });
 it("detecta conceptos GeoIA con palabras de dominio, sin exigir IA para cada término",()=>{
  expect(topicPattern.test("SIG y análisis espacial para municipios")).toBe(true);
  expect(topicPattern.test("Satellite imagery and remote sensing")).toBe(true);
  expect(topicPattern.test("Publicación de boletín de prensa")).toBe(false);
 });
});
