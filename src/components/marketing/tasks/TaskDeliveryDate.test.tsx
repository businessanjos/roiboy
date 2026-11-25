import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TaskDeliveryDate } from "./TaskDeliveryDate";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 25, 14, 10));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("Atalhos da data de entrega", () => {
  it("Hoje seleciona o dia 25 de novembro no calendário local", () => {
    const change = vi.fn();
    render(<TaskDeliveryDate onChange={change} onValidityChange={vi.fn()} portalContainer={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Entregar hoje" }));
    expect(change).toHaveBeenCalledWith(new Date(2026, 10, 25));
  });

  it("Amanhã seleciona o dia 26 de novembro no calendário local", () => {
    const change = vi.fn();
    render(<TaskDeliveryDate onChange={change} onValidityChange={vi.fn()} portalContainer={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Entregar amanhã" }));
    expect(change).toHaveBeenCalledWith(new Date(2026, 10, 26));
  });

  it.each([
    [new Date(2026, 10, 30, 23, 59), new Date(2026, 11, 1)],
    [new Date(2026, 11, 31, 23, 59), new Date(2027, 0, 1)],
  ])("Amanhã atravessa mês e ano por dia local: %s", (now, expected) => {
    vi.setSystemTime(now);
    const change = vi.fn();
    render(<TaskDeliveryDate onChange={change} onValidityChange={vi.fn()} portalContainer={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Entregar amanhã" }));
    expect(change).toHaveBeenCalledWith(expected);
  });

  it("o atalho substitui uma data parcial e restaura a validade para salvar", () => {
    const change = vi.fn();
    const validity = vi.fn();
    render(<TaskDeliveryDate onChange={change} onValidityChange={validity} portalContainer={null} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "04/12/202" } });
    expect(validity).toHaveBeenLastCalledWith(false);
    fireEvent.click(screen.getByRole("button", { name: "Entregar hoje" }));
    expect(change).toHaveBeenLastCalledWith(new Date(2026, 10, 25));
    expect(validity).toHaveBeenLastCalledWith(true);
  });

  it("não altera a data enquanto a tarefa está sendo salva", () => {
    const change = vi.fn();
    render(<TaskDeliveryDate disabled onChange={change} onValidityChange={vi.fn()} portalContainer={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Entregar hoje" }));
    fireEvent.click(screen.getByRole("button", { name: "Entregar amanhã" }));
    expect(change).not.toHaveBeenCalled();
  });
});