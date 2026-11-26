// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { BusinessForm } from "../src/features/business/business-form";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

afterEach(cleanup);

it("muestra categorías de gastos y distingue suscripciones de consumo de IA", () => {
  render(<BusinessForm resource="gastos" choices={{}} />);
  fireEvent.click(screen.getByRole("button", { name: /Registrar gasto/ }));
  const category = screen.getByRole<HTMLSelectElement>("combobox", { name: /Categoría/ });
  const options = Array.from(category.options, option => option.value);
  expect(category.value).toBe("");
  expect(options).toHaveLength(14);
  expect(options).toEqual(expect.arrayContaining([
    "Constitución y trámites", "Dominio y correo corporativo", "Suscripciones de IA", "Consumo de IA por API",
  ]));
});

it("conserva seleccionada la categoría anterior al editar un gasto", () => {
  render(<BusinessForm resource="gastos" choices={{}} row={{ id: "expense", category: "Infraestructura anterior" }} />);
  fireEvent.click(screen.getByRole("button", { name: "Editar gasto" }));
  const category = screen.getByRole<HTMLSelectElement>("combobox", { name: /Categoría/ });
  expect(category.value).toBe("Infraestructura anterior");
  expect(category.selectedOptions[0].textContent).toBe("Infraestructura anterior (categoría registrada)");
});
