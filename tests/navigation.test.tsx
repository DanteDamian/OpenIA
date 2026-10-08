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
import { Dashboard } from "../src/features/dashboard/dashboard";
vi.mock("next/navigation", () => ({ usePathname: () => "/clientes" }));
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
  it("muestra indicadores vacíos y enlaces a los siete módulos", () => {
    render(<Dashboard />);
    expect(screen.getAllByLabelText("Sin datos")).toHaveLength(4);
    const section = screen.getByRole("region", {
      name: "Módulos administrativos",
    });
    expect(within(section).getAllByRole("link")).toHaveLength(7);
    expect(screen.getByText("Sin proyectos registrados")).toBeInTheDocument();
  });
});
