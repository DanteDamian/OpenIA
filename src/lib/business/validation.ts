import { validUuid } from "@/lib/auth/validation";
import { resources } from "./model";
export function cents(value: string | number): bigint {
  const text = String(value);
  if (!/^\d{1,16}(?:\.\d{1,2})?$/.test(text)) throw new Error("Invalid decimal");
  const [whole, fraction = ""] = text.split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
}
export function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number(value.slice(0,4)) >= 1900 && Number(value.slice(0,4)) <= 9999
    && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0,10) === value;
}
export function businessInput(resourceName: string, value: unknown) {
  const definition = Object.hasOwn(resources, resourceName) ? resources[resourceName] : null;
  if (!definition || !value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (Object.keys(raw).some(key => !definition.fields.some(field => field.name === key))) return null;
  const result: Record<string, string | null> = {};
  for (const field of definition.fields) {
    const value = raw[field.name];
    if (value !== undefined && value !== null && typeof value !== "string") return null;
    const text = typeof value === "string" ? value.trim() : "";
    if (!text && field.required) return null;
    if (!text) { result[field.name] = null; continue; }
    if (text.length > (field.max || 200)) return null;
    if (field.options && !field.options.includes(text)) return null;
    if (field.type === "uuid" && !validUuid(text)) return null;
    if (field.type === "date") { try { if (!validDate(text)) return null; } catch { return null; } }
    if (field.type === "money") {
      try { if (cents(text) < 0n || ((resourceName === "gastos" || resourceName === "tesoreria") && cents(text) === 0n)) return null; }
      catch { return null; }
    }
    result[field.name] = text;
  }
  if (result.ends_on && (!result.starts_on || result.ends_on < result.starts_on)) return null;
  if (result.valid_until && result.issued_on && result.valid_until < result.issued_on) return null;
  if (resourceName === "cotizaciones" && cents(result.discount_amount!) > cents(result.subtotal!)) return null;
  return result;
}
export function formatMoney(value: bigint) {
  const sign = value < 0n ? "−" : ""; const absolute = value < 0n ? -value : value;
  return `${sign}$ ${(absolute / 100n).toLocaleString("es-CO")},${String(absolute % 100n).padStart(2,"0")} COP`;
}
