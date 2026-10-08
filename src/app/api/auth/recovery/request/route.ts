import { hasTrustedOrigin } from "@/lib/auth/origin";
import { boundedJson, json } from "@/lib/auth/http";
import { recoveryConfiguration, recoveryClient } from "@/lib/auth/recovery";
import { randomInt } from "node:crypto";
export async function POST(request: Request) {
  const config = recoveryConfiguration();
  if (!config)
    return json({ error: "Recuperación pendiente de configuración." }, 503);
  if (!hasTrustedOrigin(request, config.origin))
    return json({ error: "Solicitud no autorizada." }, 403);
  const input = (await boundedJson(request)) as { email?: unknown } | null;
  if (
    !input ||
    typeof input.email !== "string" ||
    input.email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())
  )
    return json({ error: "Revisa el correo electrónico." }, 400);
  const started = Date.now();
  try {
    await recoveryClient(config).auth.resetPasswordForEmail(
      input.email.trim(),
      {
        redirectTo: `${config.origin}/recuperar/confirmar`,
      },
    );
  } catch {
    /* No distinguir cuentas, SMTP, límites ni errores del proveedor. */
  }
  // Amortiguar respuestas rápidas de rechazo sin prometer latencia constante
  // frente al proveedor SMTP. Sus límites de envío siguen siendo necesarios.
  await new Promise((resolve) =>
    setTimeout(
      resolve,
      Math.max(0, 1000 - (Date.now() - started)) + randomInt(0, 201),
    ),
  );
  return json({
    message:
      "Si existe una cuenta que pueda recuperar su acceso, recibirá un enlace por correo. Revisa también la carpeta de spam.",
  });
}
