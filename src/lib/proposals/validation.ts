import { validUuid } from "@/lib/auth/validation";
import { proposalSectionKeys, proposalStatuses, type ProposalSectionKey } from "./model";

const decimal = /^\d{1,16}(?:\.\d{1,2})?$/;
export function decimalHundredths(value: string) {
  if (!decimal.test(value)) throw new Error("Decimal inválido");
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
}
export function lineAmounts(quantity: string, unitPrice: string, discount: string, tax: string) {
  const q = decimalHundredths(quantity);
  const price = decimalHundredths(unitPrice);
  const discountValue = decimalHundredths(discount);
  const taxValue = decimalHundredths(tax);
  if (q <= 0n || price < 0n) throw new Error("Importe inválido");
  const raw = q * price;
  const subtotal = (raw + 50n) / 100n;
  if (discountValue > subtotal) throw new Error("Descuento inválido");
  return { subtotal, total: subtotal - discountValue + taxValue };
}
export function decimalString(value: bigint) {
  return `${value / 100n}.${String(value % 100n).padStart(2, "0")}`;
}
export function proposalCreateInput(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const allowed = ["code", "title", "client_id", "call_for_proposal_id", "opportunity_id", "valid_until"];
  if (Object.keys(raw).some((key) => !allowed.includes(key))) return null;
  const text = (key: string, max: number) => typeof raw[key] === "string" && raw[key].trim().length > 0 && raw[key].trim().length <= max ? raw[key].trim() : null;
  const code = text("code", 60), title = text("title", 200), clientId = text("client_id", 36);
  if (!code || !title || !clientId || !validUuid(clientId)) return null;
  const optionalUuid = (key: string) => raw[key] === "" || raw[key] == null ? null : typeof raw[key] === "string" && validUuid(raw[key]) ? raw[key] : undefined;
  const callId = optionalUuid("call_for_proposal_id"), opportunityId = optionalUuid("opportunity_id");
  if (callId === undefined || opportunityId === undefined) return null;
  const validUntil = raw.valid_until === "" || raw.valid_until == null ? null : typeof raw.valid_until === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.valid_until) ? raw.valid_until : undefined;
  if (validUntil === undefined) return null;
  return { code, title, client_id: clientId, call_for_proposal_id: callId, opportunity_id: opportunityId, valid_until: validUntil };
}
export function sectionInput(value: unknown): { sectionKey: ProposalSectionKey; content: string } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (raw.type !== "section" || typeof raw.sectionKey !== "string" || !proposalSectionKeys.includes(raw.sectionKey as ProposalSectionKey) || typeof raw.content !== "string" || raw.content.length > 30000) return null;
  return { sectionKey: raw.sectionKey as ProposalSectionKey, content: raw.content.trim() };
}
export function itemInput(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (raw.type !== "item" || typeof raw.description !== "string" || !raw.description.trim() || raw.description.trim().length > 500) return null;
  const values = [raw.quantity, raw.unitPrice, raw.discountAmount, raw.taxAmount];
  if (!values.every((entry) => typeof entry === "string" && decimal.test(entry))) return null;
  try { lineAmounts(raw.quantity as string, raw.unitPrice as string, raw.discountAmount as string, raw.taxAmount as string); } catch { return null; }
  const id = raw.id == null || raw.id === "" ? null : typeof raw.id === "string" && validUuid(raw.id) ? raw.id : undefined;
  if (id === undefined) return null;
  return { id, description: raw.description.trim(), quantity: raw.quantity as string, unit_price: raw.unitPrice as string, discount_amount: raw.discountAmount as string, tax_amount: raw.taxAmount as string };
}
export function statusInput(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  return raw.type === "status" && typeof raw.status === "string" && proposalStatuses.includes(raw.status as never) ? raw.status : null;
}

