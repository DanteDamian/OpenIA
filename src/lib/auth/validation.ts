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
export function clientInput(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !["legal_name", "email"].includes(key)))
    return null;
  if (
    typeof input.legal_name !== "string" ||
    !input.legal_name.trim() ||
    input.legal_name.trim().length > 200
  )
    return null;
  if (
    input.email !== undefined &&
    input.email !== null &&
    (typeof input.email !== "string" ||
      input.email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email))
  )
    return null;
  return {
    legal_name: input.legal_name.trim(),
    email: typeof input.email === "string" ? input.email.trim() : null,
  };
}
export function sameOrigin(request: Request) {
  const url = new URL(request.url);
  // Next.js puede usar localhost internamente; Host sigue siendo el destino
  // de la petición. Nunca confiar en X-Forwarded-Host enviado por el cliente.
  const host = request.headers.get("host") || url.host;
  return request.headers.get("origin") === `${url.protocol}//${host}`;
}
