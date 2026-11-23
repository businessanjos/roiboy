import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// O jsdom não implementa scrollIntoView, que o seletor do Radix chama ao abrir.
Element.prototype.scrollIntoView = () => {};

const AGENCIES = [
  { name: "Impulse", id: "impulse" },
  { name: "Social Nudge", id: "social-nudge" },
];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: { traffic_agencies: AGENCIES } }) }),
      }),
    }),
  },
}));

import { TrafficHubFields } from "../TrafficHubFields";
import type { TrafficParts } from "@/lib/tv/trafficHub";

function renderFields(value: TrafficParts, onChange = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <TrafficHubFields value={value} onChange={onChange} />
    </QueryClientProvider>,
  );
  return onChange;
}

describe("campos da Central de Tráfego", () => {
  it("não tem o botão Editar ao lado de Agência", async () => {
    renderFields({ kind: "paid", agencia: "social-nudge", periodo: "mes" });
    await waitFor(() => expect(screen.getByText("Agência")).toBeInTheDocument());
    expect(screen.queryByText("Editar")).toBeNull();
  });

  it("mostra a agência escolhida na lista salva", async () => {
    renderFields({ kind: "paid", agencia: "social-nudge", periodo: "mes" });
    await waitFor(() => expect(screen.getByText("Social Nudge")).toBeInTheDocument());
  });

  it("no orgânico não aparece o campo Agência", async () => {
    renderFields({ kind: "organic", periodo: "hoje" });
    await waitFor(() => expect(screen.getByText("Período")).toBeInTheDocument());
    expect(screen.queryByText("Agência")).toBeNull();
  });

  it("trocar o período devolve o novo valor", async () => {
    const onChange = renderFields({ kind: "paid", agencia: "impulse", periodo: "mes" });
    await waitFor(() => expect(screen.getByText("Este mês")).toBeInTheDocument());
    const triggers = screen.getAllByRole("combobox");
    const period = triggers.find((t) => t.textContent?.includes("Este mês"));
    expect(period).toBeDefined();
    fireEvent.keyDown(period as HTMLElement, { key: "Enter" });
    fireEvent.click(await screen.findByRole("option", { name: "Este ano" }));
    expect(onChange).toHaveBeenCalledWith({ kind: "paid", agencia: "impulse", periodo: "ano" });
  });
});
