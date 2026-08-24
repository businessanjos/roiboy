import { describe, it, expect } from "vitest";
import { getClientDetailId, isClientDetailRoute } from "./clientRoutes";

describe("clientRoutes", () => {
  it("mantém o sidebar principal nas rotas reservadas de /clients/", () => {
    expect(isClientDetailRoute("/clients/checkpoints")).toBe(false);
    expect(isClientDetailRoute("/clients/medicos")).toBe(false);
    expect(isClientDetailRoute("/clients/new")).toBe(false);
  });

  it("mantém o sidebar principal na listagem e em subrotas mais profundas", () => {
    expect(isClientDetailRoute("/clients")).toBe(false);
    expect(isClientDetailRoute("/clients/")).toBe(false);
    expect(isClientDetailRoute("/clients/checkpoints/relatorio")).toBe(false);
  });

  it("detecta a ficha individual do cliente", () => {
    const id = "8f1c2d3e-4a5b-6c7d-8e9f-0a1b2c3d4e5f";
    expect(isClientDetailRoute(`/clients/${id}`)).toBe(true);
    expect(getClientDetailId(`/clients/${id}`)).toBe(id);
  });

  it("ignora rotas fora de /clients", () => {
    expect(isClientDetailRoute("/tasks")).toBe(false);
    expect(getClientDetailId("/renewals")).toBeNull();
  });
});
