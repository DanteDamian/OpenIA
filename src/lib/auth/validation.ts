import { authOrigin, hasTrustedOrigin } from "./origin";
export function validUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}
export function canManageClients(role: string) {
  return role === "admin" || role === "manager";
}
function nullableText(value: unknown, maxLength: number) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > maxLength) return undefined;
  return value.trim() || null;
}
function editableInput(value: unknown, requiredName: string, optional: Record<string, number>, editing = false) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(key => key !== requiredName && !Object.hasOwn(optional, key))) return null;
  if (!Object.hasOwn(input, requiredName)) return null;
  const name = nullableText(input[requiredName], 200);
  if (!name) return null;
  const result: Record<string, string | null> = { [requiredName]: name };
  for (const [key, max] of Object.entries(optional)) {
    if (!Object.hasOwn(input, key) && (key !== "email" || editing)) continue;
    const text = nullableText(input[key], max);
    if (text === undefined) return null;
    if (key === "email" && text && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return null;
    result[key] = text;
  }
  return result;
}
export function clientInput(value: unknown, editing = false) {
  const result = editableInput(value, "legal_name", {
    email: 254, phone: 40, address: 1000, document_type: 20, document_number: 40, status: 20,
  }, editing);
  if (!result) return null;
  if ("document_type" in result || "document_number" in result) {
    if (Object.hasOwn(result, "document_type") !== Object.hasOwn(result, "document_number")) return null;
    const type = result.document_type ?? null;
    const number = result.document_number ?? null;
    if ((type === null) !== (number === null)) return null;
    if (type && !["NIT", "CC", "CE", "PASSPORT", "OTHER"].includes(type)) return null;
    result.document_type = type;
    result.document_number = number;
  }
  if ("status" in result && !["active", "inactive"].includes(result.status || "")) return null;
  return result;
}
export function contactInput(value: unknown, editing = false) {
  return editableInput(value, "full_name", { email: 254, phone: 40, job_title: 200 }, editing);
}
export function sameOrigin(
  request: Request,
  env: Record<string, string | undefined> = process.env,
) {
  return hasTrustedOrigin(request, authOrigin(env));
}
