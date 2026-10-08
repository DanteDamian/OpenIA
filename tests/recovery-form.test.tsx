// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { StrictMode } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
const replace = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
import { RecoveryForm } from "../src/features/auth/recovery-form";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/");
});
describe("Enlace de recuperación en el navegador", () => {
  it("borra fragmento/query sin consumir el enlace automáticamente y usa POST tras confirmar", async () => {
    const hash = "a".repeat(64);
    window.history.replaceState(
      null,
      "",
      `/recuperar/confirmar?next=untrusted#token_hash=${hash}`,
    );
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    vi.stubGlobal("fetch", fetchMock);
    render(
      <StrictMode>
        <RecoveryForm mode="verify" />
      </StrictMode>,
    );
    expect(window.location.hash).toBe("");
    expect(window.location.search).toBe("");
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Validar enlace" }));
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/recuperar/nueva"),
    );
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/recovery/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tokenHash: hash }),
    });
    expect(document.body.textContent).not.toContain(hash);
  });
  it("rechaza tokens implícitos y fragmentos con destinos adicionales", () => {
    window.history.replaceState(
      null,
      "",
      `/recuperar/confirmar#token_hash=${"a".repeat(64)}&next=https://evil.example`,
    );
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<RecoveryForm mode="verify" />);
    fireEvent.click(screen.getByRole("button", { name: "Validar enlace" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Enlace inválido o vencido",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
