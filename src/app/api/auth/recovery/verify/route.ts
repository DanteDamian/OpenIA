import { cookies } from "next/headers";
import { boundedJson, json } from "@/lib/auth/http";
import { recoveryConfiguration, recoveryClient } from "@/lib/auth/recovery";
import {
  recoveryCookie,
  recoveryLifetime,
  sealRecovery,
  validRecoveryToken,
} from "@/lib/auth/recovery-security";
export async function POST(request: Request) {
  const config = recoveryConfiguration();
  if (!config)
    return json({ error: "Recuperación pendiente de configuración." }, 503);
  if (request.headers.get("origin") !== config.origin)
    return json({ error: "Solicitud no autorizada." }, 403);
  const store = await cookies();
  store.delete(recoveryCookie);
  const input = (await boundedJson(request)) as { tokenHash?: unknown } | null;
  if (!input || !validRecoveryToken(input.tokenHash))
    return json(
      { error: "Enlace inválido o vencido. Solicita uno nuevo." },
      400,
    );
  try {
    const { data, error } = await recoveryClient(config).auth.verifyOtp({
      token_hash: input.tokenHash,
      type: "recovery",
    });
    if (error || !data.session || !data.user)
      return json(
        { error: "Enlace inválido o vencido. Solicita uno nuevo." },
        400,
      );
    const expiresAt = Math.min(
      Date.now() + recoveryLifetime * 1000,
      (data.session.expires_at ?? 0) * 1000,
    );
    if (expiresAt <= Date.now())
      return json(
        { error: "Enlace inválido o vencido. Solicita uno nuevo." },
        400,
      );
    const sealed = sealRecovery(
      {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        userId: data.user.id,
        expiresAt,
      },
      config.secret,
    );
    if (sealed.length > 3800)
      return json({ error: "No fue posible validar el enlace." }, 503);
    store.set(recoveryCookie, sealed, {
      httpOnly: true,
      secure: config.origin.startsWith("https:"),
      sameSite: "strict",
      path: "/",
      maxAge: Math.floor((expiresAt - Date.now()) / 1000),
    });
    return json({ success: true });
  } catch {
    return json(
      { error: "No fue posible validar el enlace. Solicita uno nuevo." },
      400,
    );
  }
}
