import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const totals: Record<string, number> = { A: 45, B: 3 };
const calls: Array<{ account: string; from: number }> = [];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      let account = "";
      const q = {
        select: () => q,
        eq: (_c: string, v: string) => {
          account = v;
          return q;
        },
        order: () => q,
        range: (from: number, to: number) => {
          calls.push({ account, from });
          const total = totals[account] ?? 0;
          const n = Math.max(0, Math.min(to, total - 1) - from + 1);
          return Promise.resolve({
            data: Array.from({ length: n }, (_, i) => ({
              id: `${account}-${from + i}`,
              status: "success",
              started_at: new Date().toISOString(),
              transactions_imported: 1,
            })),
            count: total,
            error: null,
          });
        },
      };
      return q;
    },
  },
}));

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

import { SyncHistoryDialog } from "../FinancialPluggyStatusPage";

const ui = (qc: QueryClient, accountId: string, open = true) => (
  <QueryClientProvider client={qc}>
    <SyncHistoryDialog accountId={accountId} accountName={accountId} open={open} onOpenChange={() => {}} />
  </QueryClientProvider>
);

describe("Histórico do Pluggy — total vem do cache", () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it("A(45) → B(3) → A com cache fresco mantém total 45 e Próxima habilitada, sem nova requisição", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: false } } });
    const { rerender, unmount } = render(ui(qc, "A"));
    await screen.findByText(/1–20 de 45/);

    rerender(ui(qc, "B"));
    await screen.findByText(/1–3 de 3/);

    const before = calls.filter((c) => c.account === "A").length;
    rerender(ui(qc, "A"));
    await screen.findByText(/1–20 de 45/);
    expect(calls.filter((c) => c.account === "A").length).toBe(before);
    expect(screen.getByRole("button", { name: /próxima/i })).not.toBeDisabled();

    // Fechar e reabrir com o mesmo QueryClient também usa o cache.
    unmount();
    render(ui(qc, "A"));
    await screen.findByText(/1–20 de 45/);
    await waitFor(() => expect(calls.filter((c) => c.account === "A").length).toBe(before));
    expect(screen.getByRole("button", { name: /próxima/i })).not.toBeDisabled();
  });
});
