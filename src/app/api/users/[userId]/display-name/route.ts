import { boundedJson, json } from "@/lib/auth/http";
import { getAccess } from "@/lib/auth/session";
import { sameOrigin, validUuid } from "@/lib/auth/validation";

export async function PATCH(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  if (!sameOrigin(request)) return json({ error: "Origen no autorizado." }, 403);
  const access = await getAccess();
  if (access.status !== "authorized") return json({ error: "Sesión no autorizada." }, 401);
  if (access.role !== "admin") return json({ error: "Solo administradores pueden editar nombres." }, 403);

  const { userId } = await params;
  const input = await boundedJson(request);
  const name = input && typeof input === "object" && "display_name" in input ? input.display_name : null;
  const displayName = typeof name === "string" ? name.trim() : "";
  if (!validUuid(userId) || !displayName || displayName.length > 200) {
    return json({ error: "Ingresa un nombre de hasta 200 caracteres." }, 400);
  }

  const { error } = await access.supabase.rpc("set_organization_member_display_name", {
    target_organization: access.organizationId,
    target_user: userId,
    new_display_name: displayName,
  });
  if (error) {
    return json({ error: "No fue posible actualizar el nombre de este usuario." }, error.code === "42501" ? 403 : 400);
  }
  return json({ success: true });
}
