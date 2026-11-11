import { describe, expect, it } from "vitest";
import { businessInput } from "@/lib/business/validation";
import { businessSort, resources } from "@/lib/business/model";
import { bogotaToday, deadlineAlert } from "@/lib/business/deadline-alert";
describe("Convocatorias", () => {
  const valid = { name:"Convocatoria SIG", issuer_name:"Entidad convocante", amount:"1200000.00", topic:"Análisis geoespacial", priority:"high",
    link:"https://example.com/convocatoria", presentation_date:"2026-12-01", status:"En proceso", responsible:"Daniel Bula" };
  it("expone los campos de seguimiento solicitados", () => {
    expect(resources.convocatorias.fields.map(field => field.name))
      .toEqual(["name","issuer_name","amount","topic","priority","link","presentation_date","status","responsible","observations"]);
    expect(resources.convocatorias.listFields).toEqual(["name","amount","priority","responsible","status","presentation_date","observations","link"]);
  });
  it("acepta importes, prioridades y seguimiento válidos", () => {
    expect(businessInput("convocatorias", {...valid,observations:"Seguimiento comercial"})).toMatchObject({...valid,observations:"Seguimiento comercial"});
    expect(businessInput("convocatorias", { ...valid, priority:"medium", link:null, presentation_date:null, status:null, responsible:null })).not.toBeNull();
  });
  it("rechaza dominios, enlaces e importes inválidos", () => {
    expect(businessInput("convocatorias", { ...valid, priority:"critical" })).toBeNull();
    expect(businessInput("convocatorias", { ...valid, status:"Finalizado" })).toBeNull();
    expect(businessInput("convocatorias", { ...valid, responsible:"Otra persona" })).toBeNull();
    expect(businessInput("convocatorias", { ...valid, link:"javascript:alert(1)" })).toBeNull();
    expect(businessInput("convocatorias", { ...valid, amount:"-1" })).toBeNull();
    expect(businessInput("convocatorias", { ...valid, observations:"x".repeat(4001) })).toBeNull();
    expect(businessInput("convocatorias", { ...valid, issuer_name:"" })).toBeNull();
  });
  it("solo permite ordenar por columnas visibles", () => {
    const visible=resources.convocatorias.listFields!;
    expect(businessSort({sort:"amount",direction:"desc"},visible)).toEqual({sort:"amount",direction:"desc"});
    expect(businessSort({sort:"priority",direction:"asc"},visible)).toEqual({sort:"priority",direction:"asc"});
    expect(businessSort({sort:"organization_id",direction:"desc"},visible)).toEqual({sort:"",direction:"desc"});
    expect(businessSort({sort:"status",direction:"unexpected"},visible)).toEqual({sort:"status",direction:"asc"});
  });
  it("calcula alertas mensuales sin modificar fechas ni registros", () => {
    const today="2026-11-11";
    expect(deadlineAlert("2026-11-30","En proceso",today).tone).toBe("red");
    expect(deadlineAlert("2026-12-01","Sin iniciar",today).tone).toBe("yellow");
    expect(deadlineAlert("2027-01-01","Sin iniciar",today).tone).toBe("neutral");
    expect(deadlineAlert("2027-02-01","Sin iniciar",today).tone).toBe("green");
    expect(deadlineAlert("2026-11-10","En proceso",today).label).toBe("Vencida");
    expect(deadlineAlert("2026-12-01","terminado",today).tone).toBe("neutral");
    expect(deadlineAlert(null,null,today).label).toBe("Sin fecha");
    expect(bogotaToday(new Date("2026-12-01T02:00:00Z"))).toBe("2026-11-30");
  });
  it("rejects extra fields supplied by clients", () => {
    expect(businessInput("convocatorias", { ...valid, organization_id:"other" })).toBeNull();
  });
});
