import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export const recoveryCookie = "aigenterra-recovery";
export const recoveryLifetime = 600;
export function recoveryOrigin(env: Record<string, string | undefined>) {
  const value =
    env.AUTH_SITE_URL ||
    (env.VERCEL_ENV === "preview" && env.VERCEL_URL
      ? `https://${env.VERCEL_URL}`
      : "");
  try {
    const url = new URL(value);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !["", "/"].includes(url.pathname) ||
      (local && (env.NODE_ENV === "production" || !!env.VERCEL_ENV)) ||
      (url.protocol !== "https:" && !(local && url.protocol === "http:"))
    )
      return null;
    return url.origin;
  } catch {
    return null;
  }
}
export function validRecoveryToken(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{20,512}$/.test(value);
}
export function validNewPassword(value: unknown): value is string {
  return typeof value === "string" && value.length >= 12 && value.length <= 128;
}
export type RecoveryGrant = {
  accessToken: string;
  refreshToken: string;
  userId: string;
  expiresAt: number;
};
function key(secret: string) {
  if (!/^[a-fA-F0-9]{64}$/.test(secret))
    throw new Error("Recovery secret is not configured");
  return Buffer.from(secret, "hex");
}
export function sealRecovery(grant: RecoveryGrant, secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  cipher.setAAD(Buffer.from(recoveryCookie));
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(grant), "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
    "base64url",
  );
}
export function openRecovery(
  value: string | undefined,
  secret: string,
  now = Date.now(),
): RecoveryGrant | null {
  try {
    if (!value || value.length > 3800 || !/^[a-zA-Z0-9_-]+$/.test(value)) return null;
    const bytes = Buffer.from(value, "base64url");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key(secret),
      bytes.subarray(0, 12),
    );
    decipher.setAAD(Buffer.from(recoveryCookie));
    decipher.setAuthTag(bytes.subarray(12, 28));
    const grant = JSON.parse(
      Buffer.concat([
        decipher.update(bytes.subarray(28)),
        decipher.final(),
      ]).toString("utf8"),
    );
    if (
      typeof grant.accessToken !== "string" ||
      typeof grant.refreshToken !== "string" ||
      typeof grant.userId !== "string" ||
      !Number.isFinite(grant.expiresAt) ||
      grant.expiresAt <= now ||
      grant.expiresAt > now + recoveryLifetime * 1000
    )
      return null;
    return grant;
  } catch {
    return null;
  }
}
