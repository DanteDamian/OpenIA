import { validUuid } from "@/lib/auth/validation";
export const roleOptions = [
  {value:"admin",label:"Administrador"}, {value:"manager",label:"Gestor"},
  {value:"accountant",label:"Contador"}, {value:"viewer",label:"Consulta"},
];
export function memberInput(raw: unknown, editing: boolean) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const input = raw as Record<string,unknown>;
  const keys = editing ? ["user_id","role_id","is_active"] : ["email","role_id"];
  if (Object.keys(input).length !== keys.length || keys.some(key => !Object.hasOwn(input,key)) || Object.keys(input).some(key => !keys.includes(key))) return null;
  if (!roleOptions.some(role => role.value === input.role_id)) return null;
  if (editing) {
    if (!validUuid(input.user_id) || !["true","false"].includes(input.is_active as string)) return null;
    return {user_id:input.user_id as string,role_id:input.role_id as string,is_active:input.is_active === "true"};
  }
  if (typeof input.email !== "string" || input.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) return null;
  return {email:input.email.trim(),role_id:input.role_id as string};
}
