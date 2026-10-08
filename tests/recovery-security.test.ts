import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import {
  recoveryOrigin,
  sealRecovery,
  openRecovery,
  validNewPassword,
  validRecoveryToken,
} from "../src/lib/auth/recovery-security";
describe("Seguridad de recuperación", () => {
  it("usa el origen HTTPS del despliegue y no confía en Host", () => {
    expect(
      recoveryOrigin({
        VERCEL_ENV: "preview",
        VERCEL_URL: "aigenterra-preview.vercel.app",
        NODE_ENV: "production",
      }),
    ).toBe("https://aigenterra-preview.vercel.app");
    expect(
      recoveryOrigin({
        AUTH_SITE_URL: "https://finance.example/",
        NODE_ENV: "production",
      }),
    ).toBe("https://finance.example");
    for (const value of [
      "http://localhost:3000",
      "https://localhost",
      "http://remote.example",
      "https://app.example/?next=evil",
      "https://user:pass@app.example",
      "https://app.example/path",
      "javascript:alert(1)",
    ]) {
      expect(
        recoveryOrigin({ AUTH_SITE_URL: value, VERCEL_ENV: "production" }),
      ).toBeNull();
    }
    expect(
      recoveryOrigin({
        AUTH_SITE_URL: "http://127.0.0.1:3000",
        NODE_ENV: "development",
      }),
    ).toBe("http://127.0.0.1:3000");
  });
  it("cifra el grant y rechaza manipulación, otro secreto y caducidad", () => {
    const secret = randomBytes(32).toString("hex");
    const now = Date.now();
    const grant = {
      accessToken: "ephemeral-access",
      refreshToken: "ephemeral-refresh",
      userId: "fixture-id",
      expiresAt: now + 60000,
    };
    const sealed = sealRecovery(grant, secret);
    expect(sealed).not.toContain(grant.accessToken);
    expect(openRecovery(sealed, secret, now)).toEqual(grant);
    expect(openRecovery(`${sealed}#`, secret, now)).toBeNull();
    expect(
      openRecovery(sealed, randomBytes(32).toString("hex"), now),
    ).toBeNull();
    const bytes = Buffer.from(sealed, "base64url");
    bytes[30] ^= 1;
    expect(openRecovery(bytes.toString("base64url"), secret, now)).toBeNull();
    expect(openRecovery(sealed, secret, now + 60001)).toBeNull();
    expect(openRecovery("normal-session-cookie", secret, now)).toBeNull();
    expect(
      openRecovery(
        sealRecovery({ ...grant, expiresAt: now + 601000 }, secret),
        secret,
        now,
      ),
    ).toBeNull();
  });
  it("valida tokens y contraseñas sin normalizar la contraseña", () => {
    expect(validRecoveryToken("a".repeat(64))).toBe(true);
    for (const value of [null, "short", "<script>".repeat(5), "a".repeat(513)])
      expect(validRecoveryToken(value)).toBe(false);
    expect(validNewPassword("a".repeat(12))).toBe(true);
    expect(validNewPassword("a".repeat(128))).toBe(true);
    expect(validNewPassword("a".repeat(11))).toBe(false);
    expect(validNewPassword("a".repeat(129))).toBe(false);
  });
});
