import { describe, expect, it } from "vitest";
import { businessInput } from "@/lib/business/validation";
import { resources } from "@/lib/business/model";
describe("Convocatorias", () => {
  const valid = { name:"Convocatoria SIG", issuer_name:"Entidad convocante", amount:"1200000.00", topic:"Análisis geoespacial", priority:"high" };
  it("exposes the requested five inputs", () => {
    expect(resources.convocatorias.fields.map(field => field.name))
      .toEqual(["name","issuer_name","amount","topic","priority"]);
  });
  it("accepts valid amounts and priorities", () => {
    expect(businessInput("convocatorias", valid)).toMatchObject(valid);
    expect(businessInput("convocatorias", { ...valid, priority:"medium" })).not.toBeNull();
  });
  it("rejects invalid priorities and financial values", () => {
    expect(businessInput("convocatorias", { ...valid, priority:"critical" })).toBeNull();
    expect(businessInput("convocatorias", { ...valid, amount:"-1" })).toBeNull();
    expect(businessInput("convocatorias", { ...valid, issuer_name:"" })).toBeNull();
  });
  it("rejects extra fields supplied by clients", () => {
    expect(businessInput("convocatorias", { ...valid, organization_id:"other" })).toBeNull();
  });
});
