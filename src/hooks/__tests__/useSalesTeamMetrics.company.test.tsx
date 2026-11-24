import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor, cleanup } from "@testing-library/react";
import { buildCompanyActivityScope } from "@/lib/sales/companyActivityScope";
import { useSalesTeamMetrics } from "@/hooks/useSalesTeamMetrics";

const mocks = vi.hoisted(() => ({ from: vi.fn(), scope: null as any }));
vi.mock("@/hooks/useCurrentUser", () => ({ useCurrentUser: () => ({ currentUser: { id: "viewer", account_id: "account" } }) }));
vi.mock("@/hooks/useSalesCompanyScope", () => ({ useSalesCompanyScope: () => ({ scope: mocks.scope, isLoading: false, error: null }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));

const deals = [
  { id: "cr-won", company_id: "anjos", responsible_user_id: "seller", client_id: "same", status: "won", value: 1000, received_value: 0 },
  { id: "cr-open", company_id: "anjos", responsible_user_id: "seller", client_id: "same", status: "open", value: 500, received_value: null },
  { id: "em-won", company_id: "eternum", responsible_user_id: "seller", client_id: "same", status: "won", value: 2000, received_value: 250 },
];
const tasks = [
  { id: "cr-held", assigned_to: "seller", deal_id: "cr-won", client_id: "same", title: "Reunião realizada", completed_at: "2026-11-10", activity_types: { name: "Reunião Realizada" } },
  { id: "em-held", assigned_to: "seller", deal_id: "em-won", client_id: "same", title: "Reunião realizada", completed_at: "2026-11-10", activity_types: { name: "Reunião Realizada" } },
  { id: "shared", assigned_to: "seller", client_id: "same", title: "Reunião realizada", completed_at: "2026-11-10", activity_types: { name: "Reunião Realizada" } },
];
beforeEach(() => {
  cleanup();
  mocks.scope = buildCompanyActivityScope(deals);
  mocks.from.mockImplementation((table: string) => {
    const filters = new Map<string, unknown>();
    const builder: any = {};
    const data = () => {
      const rows = table === "users" ? [{ id: "seller", name: "Darlan", email: "", avatar_url: null, team_role: { name: "Closer" } }]
        : table === "deals" ? deals : table === "internal_tasks" ? tasks : [];
      return rows.filter((row: any) => !filters.has("company_id") || row.company_id === filters.get("company_id"));
    };
    for (const method of ["select", "is", "or", "gte", "lte", "not", "order", "in", "neq"]) builder[method] = vi.fn(() => builder);
    builder.eq = vi.fn((key: string, value: unknown) => { filters.set(key, value); return builder; });
    builder.range = vi.fn(async (from: number, to: number) => ({ data: data().slice(from, to + 1), error: null }));
    builder.then = (resolve: any) => Promise.resolve({ data: data(), error: null }).then(resolve);
    return builder;
  });
});

describe("Ranking comercial por empresa", () => {
  it("Anjos soma apenas seus negócios e reuniões, preservando recebido zero", async () => {
    const { result } = renderHook(() => useSalesTeamMetrics({ companyId: "anjos" }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.metrics[0]).toMatchObject({ won_deals: 1, won_value: 1000, entry_value_total: 0, pipeline_value: 500, meetings_held: 1 });
  });
  it("trocar empresa atualiza receita e pipeline sem levar reuniões compartilhadas", async () => {
    const { result, rerender } = renderHook(({ companyId }) => useSalesTeamMetrics({ companyId }), { initialProps: { companyId: "anjos" } });
    await waitFor(() => expect(result.current.loading).toBe(false));
    rerender({ companyId: "eternum" });
    await waitFor(() => expect(result.current.metrics[0]?.won_value).toBe(2000));
    expect(result.current.metrics[0]).toMatchObject({ won_deals: 1, entry_value_total: 250, pipeline_value: 0, meetings_held: 1 });
  });
  it("Todas restaura as vendas das duas empresas sem mudar dados", async () => {
    const { result } = renderHook(() => useSalesTeamMetrics({ companyId: "all" }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.metrics[0]).toMatchObject({ won_deals: 2, won_value: 3000, entry_value_total: 250, pipeline_value: 500 });
  });
});