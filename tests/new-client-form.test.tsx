// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
import { NewClientForm } from "../src/features/clients/new-client-form";
import { ContactForm } from "../src/features/clients/contact-form";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
function openForm() {
  render(<NewClientForm />);
  fireEvent.click(screen.getByRole("button", { name: /Nuevo cliente/ }));
  fireEvent.change(screen.getByLabelText(/Nombre o razón social/), { target: { value: "Entidad local de prueba" } });
  return screen.getByRole("form", { name: "Nuevo cliente" });
}

describe("Registro de cliente en interfaz", () => {
  it("no permite guardar identificación incompleta", () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    const form = openForm();
    fireEvent.change(screen.getByLabelText(/Tipo de identificación/), { target: { value: "NIT" } });
    fireEvent.submit(form);
    expect(screen.getByRole("alert")).toHaveTextContent("tipo y número juntos");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("precarga la ficha y envía PATCH para editar e inactivar sin crear otro cliente", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true }); vi.stubGlobal("fetch", fetchMock);
    render(<NewClientForm client={{ id: "local-client", legal_name: "Entidad", email: "contact@example.invalid",
      phone: "555", address: "Calle", document_type: "NIT", document_number: "123-4", status: "active" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Editar cliente" }));
    expect(screen.getByLabelText(/Número de identificación/)).toHaveValue("123-4");
    fireEvent.change(screen.getByRole("combobox", { name: "Estado" }), { target: { value: "inactive" } });
    fireEvent.change(screen.getByLabelText(/Teléfono/), { target: { value: "" } });
    fireEvent.submit(screen.getByRole("form", { name: "Editar cliente" }));
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(fetchMock.mock.calls[0][0]).toBe("/api/clients?id=local-client");
    expect(fetchMock.mock.calls[0][1].method).toBe("PATCH");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ status: "inactive", phone: null, legal_name: "Entidad" });
    expect(screen.getByRole("status")).toHaveTextContent("Cliente actualizado correctamente");
  });

  it.each([false, true])("guarda contacto con campos permitidos y endpoint del cliente; edición=%s", async editing => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true }); vi.stubGlobal("fetch", fetchMock);
    render(<ContactForm clientId="local-client" contact={editing ? {
      id: "local-contact", full_name: "Contacto", email: null, phone: null, job_title: "Responsable",
    } : undefined} />);
    fireEvent.click(screen.getByRole("button", { name: editing ? "Editar contacto: Contacto" : "+ Nuevo contacto" }));
    fireEvent.change(screen.getByLabelText(/Nombre del contacto/), { target: { value: "Contacto" } });
    fireEvent.submit(screen.getByRole("form", { name: editing ? "Editar contacto" : "Nuevo contacto" }));
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(fetchMock.mock.calls[0][0]).toBe(`/api/clients/local-client/contacts${editing ? "?id=local-contact" : ""}`);
    expect(fetchMock.mock.calls[0][1].method).toBe(editing ? "PATCH" : "POST");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ full_name: "Contacto", email: null, phone: null, job_title: editing ? "Responsable" : null });
  });

  it("envía solo campos permitidos, permite correo vacío y refresca tras guardar", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201 });
    vi.stubGlobal("fetch", fetchMock);
    const form = openForm();
    expect(form).toHaveAttribute("method", "post");
    expect(screen.getByLabelText(/Nombre o razón social/)).toHaveFocus();
    fireEvent.submit(form);
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith("/api/clients", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ legal_name: "Entidad local de prueba", email: null, document_type: null, document_number: null, phone: null, status: "active", address: null }),
    });
    expect(screen.getByRole("status")).toHaveTextContent("Cliente registrado correctamente");
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Nuevo cliente/ })).toHaveFocus();
  });

  it("normaliza los campos antes del envío y bloquea envíos repetidos mientras guarda", async () => {
    let resolve!: (value: { ok: boolean }) => void;
    const fetchMock = vi.fn().mockReturnValue(new Promise(r => { resolve = r; }));
    vi.stubGlobal("fetch", fetchMock);
    const form = openForm();
    fireEvent.change(screen.getByLabelText(/Nombre o razón social/), { target: { value: "  Entidad local  " } });
    fireEvent.change(screen.getByLabelText(/Correo electrónico/), { target: { value: "contact@example.invalid" } });
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ legal_name: "Entidad local", email: "contact@example.invalid", document_type: null, document_number: null, phone: null, status: "active", address: null });
    expect(screen.getByRole("button", { name: "Guardando…" })).toBeDisabled();
    resolve({ ok: true });
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  });

  it.each([401, 403, 400, 503])("conserva los datos y no anuncia éxito ante HTTP %s", async status => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status }));
    const form = openForm();
    fireEvent.submit(form);
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByLabelText(/Nombre o razón social/)).toHaveValue("Entidad local de prueba");
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar" })).not.toBeDisabled();
  });

  it("rechaza nombre compuesto solo de espacios sin enviar y permite cancelar", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const form = openForm();
    fireEvent.change(screen.getByLabelText(/Nombre o razón social/), { target: { value: "   " } });
    fireEvent.submit(form);
    expect(screen.getByRole("alert")).toHaveTextContent("Completa los campos obligatorios");
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
  });

  it("advierte comprobar la lista si no se puede confirmar el registro por fallo de red", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    fireEvent.submit(openForm());
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Revisa la lista antes de reintentar"));
    expect(refresh).not.toHaveBeenCalled();
  });
});
