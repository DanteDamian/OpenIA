import {describe,it,expect} from "vitest";
import {tedCandidate,tedSearchUrl,tedSourceUrl} from "@/lib/radar/ted";
import {sourceInput} from "@/lib/radar/source-validation";
describe("TED EU Search API",()=>{
 it("uses the official published search endpoint and accepted source URL",()=>{
  expect(tedSearchUrl).toBe("https://api.ted.europa.eu/v3/notices/search");
  const source={name:"TED",country:"Unión Europea",category:"Contratación",official_url:tedSourceUrl,query_method:"ted",frequency:"daily",enabled:true};
  expect(sourceInput(source)).toEqual(source);
  expect(sourceInput({...source,official_url:"https://unknown.example"})).toBeNull();
 });
 it("maps a specific public notice and retains unknown deadlines",()=>{
  const item=tedCandidate({"publication-number":"00676595-2026","publication-date":"2026-11-10",
   "notice-title":{eng:["Geospatial satellite imagery assessment"]},"buyer-name":{eng:["EU agency"]}},"2026-11-11");
  expect(item?.country).toBe("Unión Europea");
  expect(item?.official_url).toBe("https://ted.europa.eu/en/notice/00676595-2026/html");
  expect(item?.deadline_on).toBeNull();
  expect(item?.budget).toBeNull();
 });
 it("does not invent process identity or include expired notices",()=>{
  const x={"publication-number":"00676595-2026","publication-date":"2026-11-10","notice-title":{eng:"Geospatial technology"}};
  expect(tedCandidate({...x,"publication-number":"unknown"},"2026-11-11")).toBeNull();
  expect(tedCandidate({...x,"deadline-receipt-tender-date-lot":"2026-10-10"},"2026-11-11")).toBeNull();
  expect(tedCandidate({...x,"notice-title":{eng:"Pencils and office furniture"}},"2026-11-11")).toBeNull();
 });
});
