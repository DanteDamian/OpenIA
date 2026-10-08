import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";
import {
  sealRecovery,
  recoveryCookie,
} from "../src/lib/auth/recovery-security";
const mocks = vi.hoisted(() => ({
  configuration: vi.fn(),
  auth: {
    resetPasswordForEmail: vi.fn(),
    verifyOtp: vi.fn(),
    getUser: vi.fn(),
    setSession: vi.fn(),
    updateUser: vi.fn(),
    signOut: vi.fn(),
  },
  store: { get: vi.fn(), set: vi.fn(), delete: vi.fn(), getAll: vi.fn() },
}));
vi.mock("@/lib/auth/recovery", () => ({
  recoveryConfiguration: mocks.configuration,
  recoveryClient: () => ({ auth: mocks.auth }),
}));
vi.mock("next/headers", () => ({ cookies: async () => mocks.store }));
import { POST as requestRecovery } from "../src/app/api/auth/recovery/request/route";
import { POST as verifyRecovery } from "../src/app/api/auth/recovery/verify/route";
import { POST as updateRecovery } from "../src/app/api/auth/recovery/update/route";
const origin = "https://preview.example";
let secret: string;
function request(body: unknown, requestOrigin = origin) {
  return new Request(`${origin}/api/auth/recovery`, {
    method: "POST",
    headers: { Origin: requestOrigin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  secret = randomBytes(32).toString("hex");
  mocks.configuration.mockReturnValue({
    origin,
    secret,
    url: "https://db.example",
    key: "public-fixture",
  });
  mocks.store.getAll.mockReturnValue([]);
});
describe("Rutas de recuperación", () => {
  it("devuelve la misma respuesta para envío correcto, cuenta inexistente y fallo SMTP", async () => {
    const responses = [];
    for (const error of [
      null,
      { message: "unknown account" },
      { message: "SMTP failed" },
    ]) {
      mocks.auth.resetPasswordForEmail.mockResolvedValueOnce({ error });
      const response = await requestRecovery(
        request({
          email: "person@example.invalid",
          redirectTo: "https://evil.example",
        }),
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toContain("no-store");
      responses.push(await response.json());
    }
    expect(responses[0]).toEqual(responses[1]);
    expect(responses[0]).toEqual(responses[2]);
    expect(mocks.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      "person@example.invalid",
      { redirectTo: `${origin}/recuperar/confirmar` },
    );
    mocks.auth.resetPasswordForEmail.mockRejectedValueOnce(
      new Error("network"),
    );
    expect(
      await (
        await requestRecovery(request({ email: "person@example.invalid" }))
      ).json(),
    ).toEqual(responses[0]);
  });
  it("rechaza CSRF en las tres rutas y falla cerrado sin configuración", async () => {
    for (const route of [requestRecovery, verifyRecovery, updateRecovery])
      expect((await route(request({}, "https://evil.example"))).status).toBe(
        403,
      );
    expect(mocks.auth.resetPasswordForEmail).not.toHaveBeenCalled();
    mocks.configuration.mockReturnValue(null);
    expect(
      (await requestRecovery(request({ email: "person@example.invalid" })))
        .status,
    ).toBe(503);
  });
  it("solo acepta OTP de recovery y no devuelve tokens al cliente", async () => {
    const tokenHash = "a".repeat(64);
    mocks.auth.verifyOtp.mockResolvedValue({
      data: {
        session: {
          access_token: "ephemeral-access",
          refresh_token: "ephemeral-refresh",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        },
        user: { id: "fixture-id" },
      },
      error: null,
    });
    const response = await verifyRecovery(
      request({ tokenHash, type: "signup", next: "https://evil.example" }),
    );
    expect(mocks.auth.verifyOtp).toHaveBeenCalledWith({
      token_hash: tokenHash,
      type: "recovery",
    });
    expect(await response.json()).toEqual({ success: true });
    const [name, sealed, options] = mocks.store.set.mock.calls[0];
    expect(name).toBe(recoveryCookie);
    expect(openGrant(sealed)?.userId).toBe("fixture-id");
    expect(options).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
    });
  });
  it("rechaza OTP inválido y no emite autorización", async () => {
    mocks.auth.verifyOtp.mockResolvedValue({
      data: {},
      error: { message: "expired" },
    });
    expect(
      (await verifyRecovery(request({ tokenHash: "a".repeat(64) }))).status,
    ).toBe(400);
    expect(mocks.store.set).not.toHaveBeenCalled();
  });
  it("exige cookie cifrada e identidad verificada antes de cambiar contraseña", async () => {
    const body = {
      password: "new-local-password",
      confirmation: "new-local-password",
    };
    expect((await updateRecovery(request(body))).status).toBe(401);
    mocks.store.get.mockReturnValue({
      value: sealRecovery(
        {
          accessToken: "access",
          refreshToken: "refresh",
          userId: "fixture-id",
          expiresAt: Date.now() + 60000,
        },
        secret,
      ),
    });
    mocks.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: "other-id" } },
      error: null,
    });
    expect((await updateRecovery(request(body))).status).toBe(401);
    expect(mocks.auth.updateUser).not.toHaveBeenCalled();
    mocks.auth.getUser.mockResolvedValue({
      data: { user: { id: "fixture-id" } },
      error: null,
    });
    mocks.auth.setSession.mockResolvedValue({ error: null });
    mocks.auth.updateUser.mockResolvedValue({ error: null });
    mocks.auth.signOut.mockResolvedValue({ error: null });
    expect(
      (
        await updateRecovery(
          request({ ...body, confirmation: "different-password" }),
        )
      ).status,
    ).toBe(400);
    expect((await updateRecovery(request(body))).status).toBe(200);
    expect(mocks.auth.updateUser).toHaveBeenCalledWith({
      password: body.password,
    });
    expect(mocks.auth.signOut).toHaveBeenCalledWith({ scope: "global" });
    expect(mocks.store.delete).toHaveBeenCalledWith(recoveryCookie);
  });
});
import { openRecovery as openGrantWithSecret } from "../src/lib/auth/recovery-security";
function openGrant(value: string) {
  return openGrantWithSecret(value, secret);
}
