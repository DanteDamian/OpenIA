// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { AppShell } from "../src/components/layout/app-shell";
import { analyze } from "../src/lib/business/analytics";
import { Dashboard } from "../src/features/dashboard/dashboard";
vi.mock("next/navigation", () => ({
  usePathname: () => "/clientes",
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));
afterEach(cleanup);
describe("Navegación administrativa", () => {
  it("marca la ruta actual y abre el menú móvil", () => {
    render(
      <AppShell>
        <p>Contenido</p>
      </AppShell>,
    );
    const button = screen.getByRole("button", { name: "Mostrar navegación" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    const nav = screen.getByRole("navigation");
    const clients = within(nav).getByRole("link", { name: /Clientes/ });
    expect(clients).toHaveAttribute("aria-current", "page");
    clients.addEventListener("click", (event) => event.preventDefault(), {
      once: true,
    });
    fireEvent.click(clients);
    expect(button).toHaveAttribute("aria-expanded", "false");
  });
  it("muestra indicadores calculados y enlaces a los módulos operativos", () => {
    render(<Dashboard summary={analyze({})} />);
    expect(screen.getByRole("region", {name:"Indicadores financieros"})).toBeInTheDocument();
    const section = screen.getByRole("region", {
      name: "Módulos administrativos",
    });
    expect(within(section).getAllByRole("link")).toHaveLength(9);
    expect(screen.getByText("No hay alertas detectadas en los registros disponibles.")).toBeInTheDocument();
  });
});
