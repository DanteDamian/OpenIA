import { cookies } from "next/headers";
import { boundedJson, json } from "@/lib/auth/http";
import { recoveryConfiguration, recoveryClient } from "@/lib/auth/recovery";
import {
  recoveryCookie,
  openRecovery,
  validNewPassword,
} from "@/lib/auth/recovery-security";
export async function POST(request: Request) {
  const config = recoveryConfiguration();
  if (!config)
    return json({ error: "Recuperación pendiente de configuración." }, 503);
  if (request.headers.get("origin") !== config.origin)
    return json({ error: "Solicitud no autorizada." }, 403);
  const store = await cookies();
  const grant = openRecovery(store.get(recoveryCookie)?.value, config.secret);
  if (!grant) {
    store.delete(recoveryCookie);
    return json(
      { error: "Enlace inválido o vencido. Solicita uno nuevo." },
      401,
    );
  }
  const input = (await boundedJson(request)) as {
    password?: unknown;
    confirmation?: unknown;
  } | null;
  if (
    !input ||
    !validNewPassword(input.password) ||
    input.password !== input.confirmation
  )
    return json(
      {
        error: "Usa entre 12 y 128 caracteres y confirma la misma contraseña.",
      },
      400,
    );
  try {
    const client = recoveryClient(config);
    const { data: identity, error: identityError } = await client.auth.getUser(
      grant.accessToken,
    );
    if (identityError || identity.user?.id !== grant.userId) {
      store.delete(recoveryCookie);
      return json(
        { error: "Enlace inválido o vencido. Solicita uno nuevo." },
        401,
      );
    }
    const { error: sessionError } = await client.auth.setSession({
      access_token: grant.accessToken,
      refresh_token: grant.refreshToken,
    });
    if (sessionError) {
      store.delete(recoveryCookie);
      return json(
        { error: "Enlace inválido o vencido. Solicita uno nuevo." },
        401,
      );
    }
    const { error } = await client.auth.updateUser({
      password: input.password,
    });
    if (error)
      return json(
        {
          error:
            "No fue posible actualizar la contraseña. Revisa sus requisitos o solicita otro enlace.",
        },
        400,
      );
    let logoutFailed = false;
    try {
      const { error } = await client.auth.signOut({ scope: "global" });
      logoutFailed = !!error;
    } catch {
      logoutFailed = true;
    }
    store.delete(recoveryCookie);
    for (const item of store.getAll())
      if (item.name.startsWith("sb-") || item.name === "aigenterra-org")
        store.delete(item.name);
    return json({
      success: true,
      message: logoutFailed
        ? "Contraseña actualizada. No fue posible cerrar todas las sesiones; contacta al administrador."
        : "Contraseña actualizada. Inicia sesión de nuevo.",
    });
  } catch {
    return json(
      { error: "No fue posible actualizar la contraseña. Intenta nuevamente." },
      503,
    );
  }
}
