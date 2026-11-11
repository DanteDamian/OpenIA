import {describe,it,expect} from "vitest";
import {pncpCandidate,pncpApiEndpoint} from "@/lib/radar/pncp";
import {sourceInput,pncpSourceUrl} from "@/lib/radar/source-validation";
describe("PNCP Brasil — validación de fuentes y registros",()=>{
 it("uses a fixed official API endpoint and canonical official record URL",()=>{
  expect(pncpApiEndpoint).toBe("https://pncp.gov.br/api/consulta/v1/contratacoes/proposta");
  const item=pncpCandidate({numeroControlePNCP:"12345678000190-2026-12",objetoCompra:"Desenvolvimento GIS geoespacial",dataPublicacaoPncp:"2026-11-08",dataEncerramentoProposta:"2026-12-12",valorTotalEstimado:120000,
   orgaoEntidade:{razaoSocial:"Instituto oficial"}},"2026-11-11");
  expect(item?.official_url).toBe("https://pncp.gov.br/app/editais/12345678000190/2026/12");
  expect(item?.country).toBe("Brasil");
  expect(item?.budget).toBe(120000);
  expect(item?.currency).toBe("BRL");
 });
 it("does not accept expired, non-specific or unrelated opportunities",()=>{
  const base={numeroControlePNCP:"12345678000190-2026-12",objetoCompra:"SIG geoespacial",dataPublicacaoPncp:"2026-11-08",dataEncerramentoProposta:"2026-12-12"};
  expect(pncpCandidate({...base,dataEncerramentoProposta:"2026-11-01"},"2026-11-11")).toBeNull();
  expect(pncpCandidate({...base,numeroControlePNCP:"unknown"},"2026-11-11")).toBeNull();
  expect(pncpCandidate({...base,objetoCompra:"Compra de papel"},"2026-11-11")).toBeNull();
 });
 it("only accepts fixed official PNCP source for automatic scanning",()=>{
  const base={name:"PNCP Brasil",country:"Brasil",category:"Contratación",official_url:pncpSourceUrl,query_method:"pncp",frequency:"daily",enabled:true};
  expect(sourceInput(base)).toEqual(base);
  expect(sourceInput({...base,official_url:"https://fake.example/"})).toBeNull();
 });
});
