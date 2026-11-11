import {describe,expect,it} from "vitest";
import {sercopCandidate,sercopEndpoint} from "@/lib/radar/sercop";
import {sourceInput,sercopOfficialUrl} from "@/lib/radar/source-validation";
describe("SERCOP Ecuador public OCDS adapter",()=>{
 it("uses the officially documented fixed endpoint",()=>{
  expect(sercopEndpoint).toBe("https://datosabiertos.compraspublicas.gob.ec/PLATAFORMA/api/search_ocds");
  const source={name:"SERCOP",country:"Ecuador",category:"Contratación",official_url:sercopOfficialUrl,query_method:"sercop",frequency:"daily",enabled:true};
  expect(sourceInput(source)).toEqual(source);
  expect(sourceInput({...source,official_url:"https://malicious.example/"})).toBeNull();
 });
 it("parses exact source OCIDs without inventing deadlines or budgets",()=>{
  const value={ocid:"ocds-5wno2w-001-LICO-GPLR-2020-2805",title:"SIG satelital",description:"Sistema de información geográfica",
   date:"2026-11-11",buyerName:"Instituto Geográfico"};
  const result=sercopCandidate(value);
  expect(result?.country).toBe("Ecuador");
  expect(result?.official_url).toContain("record?ocid=ocds-5wno2w-001-LICO-GPLR-2020-2805");
  expect(result?.deadline_on).toBeNull();
  expect(result?.budget).toBeNull();
 });
 it("rejects malformed identifiers and unrelated procurements",()=>{
  expect(sercopCandidate({ocid:"evil",description:"Sistema geográfico"})).toBeNull();
  expect(sercopCandidate({ocid:"ocds-5wno2w-001-LICO-GPLR-2020-2805",description:"Compra de papel"})).toBeNull();
 });
});
