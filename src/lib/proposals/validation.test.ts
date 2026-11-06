import { describe, expect, it } from "vitest";
import { decimalHundredths, lineAmounts, proposalCreateInput } from "./validation";
describe("proposal budget", () => {
  it("calculates decimal amounts without floating point", () => {
    expect(lineAmounts("1.25", "1000.10", "10.00", "190.00")).toEqual({ subtotal: 125013n, total: 143013n });
  });
  it("rejects excess discount and malformed decimals", () => {
    expect(() => lineAmounts("1.00", "10.00", "10.01", "0.00")).toThrow();
    expect(() => decimalHundredths("1,000")).toThrow();
  });
  it("accepts only scoped proposal fields", () => {
    expect(proposalCreateInput({ code: "PROP-001", title: "Servicio", client_id: "00000000-0000-4000-8000-000000000000", call_for_proposal_id: "", opportunity_id: "", valid_until: "" }))?.toMatchObject({ code: "PROP-001", valid_until: null });
    expect(proposalCreateInput({ code: "PROP-001", title: "Servicio", client_id: "bad", organization_id: "forged" })).toBeNull();
  });
});
