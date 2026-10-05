import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/hooks/useCurrentUser", () => ({
  useCurrentUser: () => ({ currentUser: { account_id: "acc-1" } }),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fromMock: any = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    from: (...a: any[]) => fromMock(...a),
    storage: { from: () => ({ createSignedUrl: vi.fn() }) },
  },
}));

// 25 notas fiscais -> página de 20 cabe exatamente 1 item extra na página 2.
const TOTAL = 25;
const makeInvoiceRows = (from: number, to: number) =>
  Array.from({ length: Math.min(to, TOTAL - 1) - from + 1 }, (_, i) => ({
    id: `inv-${from + i}`,
    uploaded_at: new Date().toISOString(),
    competence_month: "2024-01",
    amount: 100,
    status: "pending",
    provider: { full_name: "Fulano", company_name: "ACME", cnpj: "00", bank_pix_key: null },
  }));

function setupSupabase() {
  fromMock.mockImplementation((table: string) => {
    if (table === "hr_provider_invoices") {
      return {
        select: () => ({
          eq: () => ({
            order: () => ({
              order: () => ({
                range: (from: number, to: number) =>
                  Promise.resolve({ data: makeInvoiceRows(from, to), count: TOTAL, error: null }),
              }),
            }),
          }),
        }),
      };
    }
    if (table === "hr_service_providers") {
      return {
        select: () => ({
          eq: () => ({
            order: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      };
    }
    return { select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) };
  });
}

import FinancialProvidersPortalPage from "../FinancialProvidersPortalPage";

describe("FinancialProvidersPortalPage — remount com cache fresco", () => {
  beforeEach(() => {
    fromMock.mockReset();
    setupSupabase();
  });

  it("preserva o total de NFs e habilita a próxima página após desmontar e remontar", async () => {
    const qc1 = new QueryClient();
    const { unmount } = render(
      <QueryClientProvider client={qc1}>
        <FinancialProvidersPortalPage />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(screen.getByLabelText("Próxima página")).toBeInTheDocument());
    expect(screen.getByText(/de 25/)).toBeInTheDocument();
    expect(screen.getByLabelText("Próxima página")).not.toBeDisabled();

    unmount();
    cleanup();

    // Remonta com cache totalmente fresco (novo QueryClient), simulando reabertura
    // da tela sem que o contador fique zerado/travado na página anterior.
    const qc2 = new QueryClient();
    render(
      <QueryClientProvider client={qc2}>
        <FinancialProvidersPortalPage />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(screen.getByLabelText("Próxima página")).toBeInTheDocument());
    expect(screen.getByText(/de 25/)).toBeInTheDocument();
    expect(screen.getByLabelText("Próxima página")).not.toBeDisabled();
  });
});
