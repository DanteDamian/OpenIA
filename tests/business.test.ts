import { describe,it,expect } from "vitest";
import { resources,canWrite } from "../src/lib/business/model";
import { businessInput,cents,formatMoney,validDate } from "../src/lib/business/validation";
import { analyze } from "../src/lib/business/analytics";
const id="11111111-1111-4111-8111-111111111111";
const valid:Record<string,Record<string,string|null>>={
  oportunidades:{client_id:id,title:"Local",stage:"new"},
  cotizaciones:{client_id:id,number:"Local",status:"draft",issued_on:"2026-10-08",subtotal:"10.10",discount_amount:"0",tax_amount:"0"},
  contratos:{client_id:id,number:"Local",title:"Local",status:"draft",amount:"0"},
  proyectos:{client_id:id,name:"Local",status:"planned"},
  gastos:{supplier_name:"Local",description:"Local",category:"Local",amount:"1.01",incurred_on:"2026-10-08",status:"recorded"},
  tesoreria:{direction:"income",description:"Local",amount:"1.01",occurred_on:"2026-10-08",method:"cash",status:"recorded"},
  actividades:{project_id:id,kind:"milestone",title:"Local",status:"pending",assignee_id:id},
};
describe("Módulos operativos",()=>{
  for(const key of Object.keys(resources)) it(`valida el formulario completo de ${key} sin permitir mass assignment`,()=>{
    expect(businessInput(key,valid[key])).not.toBeNull();
    for(const field of ["organization_id","id","created_by","updated_by","currency","total","constructor"])
      expect(businessInput(key,{...valid[key],[field]:"injected"})).toBeNull();
    expect(businessInput(key,{})).toBeNull();
    expect(canWrite("admin",resources[key])).toBe(true);
    expect(canWrite("viewer",resources[key])).toBe(false);
    expect(canWrite("manager",resources[key])).toBe(resources[key].permission==="commercial");
    expect(canWrite("accountant",resources[key])).toBe(resources[key].permission==="finance");
  });
  it("maneja importes grandes y centavos sin redondear a Number",()=>{
    expect(cents("9999999999999999.99")).toBe(999999999999999999n);
    expect(cents("0.10")+cents("0.20")).toBe(30n);
    expect(formatMoney(-1n)).toContain("0,01");
    for(const value of ["NaN","Infinity","1e3","1,01","-1","1.001","10000000000000000"])
      expect(()=>cents(value)).toThrow();
  });
  it("rechaza fechas inexistentes, descuentos excesivos y relaciones UUID inválidas",()=>{
    expect(validDate("2024-02-29")).toBe(true);expect(validDate("2025-02-29")).toBe(false);
    expect(businessInput("cotizaciones",{...valid.cotizaciones,discount_amount:"11"})).toBeNull();
    expect(businessInput("cotizaciones",{...valid.cotizaciones,valid_until:"2026-01-01"})).toBeNull();
    expect(businessInput("contratos",{...valid.contratos,ends_on:"2026-10-08"})).toBeNull();
    expect(businessInput("proyectos",{...valid.proyectos,client_id:"other"})).toBeNull();
    expect(businessInput("gastos",{...valid.gastos,amount:"0"})).toBeNull();
    expect(businessInput("tesoreria",{...valid.tesoreria,amount:"0"})).toBeNull();
    expect(businessInput("constructor",{})).toBeNull();
  });
  it("excluye anulados, separa flujo efectivo de gastos y alerta por exceso real de presupuesto",()=>{
    const summary=analyze({projects:[{id,name:"Local",status:"active",budget:"0.20"}],
      expenses:[{id:"local",project_id:id,status:"recorded",amount:"0.30"},{id:"void",status:"void",amount:"99"}],
      cash_movements:[{id:"in",direction:"income",amount:"1.00",status:"recorded"},{id:"out",direction:"outgoing",amount:"0.10",status:"recorded"}],
      opportunities:[{id:"opp",stage:"new",estimated_amount:"2"},{id:"won",stage:"won",estimated_amount:"9"}]});
    expect(summary.expenses).toContain("0,30");expect(summary.cashNet).toContain("0,90");
    expect(summary.pipeline).toContain("2,00");expect(summary.alerts[0]).toContain("Presupuesto excedido");
    expect(summary.activeProjects).toBe(1);
    expect(analyze({}).projectCount).toBe(0);
  });
});
