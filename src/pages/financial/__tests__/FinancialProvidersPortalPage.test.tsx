import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/hooks/useCurrentUser", () => ({
  useCurrentUser: () => currentUserMock(),
}));

let currentUserMock = () => ({ currentUser: { account_id: "acc-1" } });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fromMock: any = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    from: (...a: any[]) => fromMock(...a),
    storage: { from: () => ({ createSignedUrl: vi.fn() }) },
  },
}));

let invoiceTotal = 25;
const rangeCalls: Array<{ from: number; to: number }> = [];

const makeInvoiceRows = (from: number, to: number) =>
  Array.from({ length: Math.max(0, Math.min(to, invoiceTotal - 1) - from + 1) }, (_, i) => ({
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
                range: (from: number, to: number) => {
                  rangeCalls.push({ from, to });
                  return Promise.resolve({ data: makeInvoiceRows(from, to), count: invoiceTotal, error: null });
                },
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

describe("FinancialProvidersPortalPage — paginação de NFs", () => {
  beforeEach(() => {
    fromMock.mockReset();
    rangeCalls.length = 0;
    invoiceTotal = 25;
    currentUserMock = () => ({ currentUser: { account_id: "acc-1" } });
    setupSupabase();
  });

  it("ao remontar com o MESMO QueryClient e staleTime positivo, não refaz a requisição e mantém contagem/navegação", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000 } } });
    const { unmount } = render(
      <QueryClientProvider client={qc}>
        <FinancialProvidersPortalPage />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(screen.getByLabelText("Próxima página")).toBeInTheDocument());
    expect(screen.getByText(/de 25/)).toBeInTheDocument();
    expect(screen.getByLabelText("Próxima página")).not.toBeDisabled();

    const callsBeforeRemount = rangeCalls.length;
    expect(callsBeforeRemount).toBeGreaterThan(0);

    unmount();
    cleanup();

    render(
      <QueryClientProvider client={qc}>
        <FinancialProvidersPortalPage />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(screen.getByLabelText("Próxima página")).toBeInTheDocument());
    expect(screen.getByText(/de 25/)).toBeInTheDocument();
    expect(screen.getByLabelText("Próxima página")).not.toBeDisabled();

    // Cache ainda fresco (staleTime positivo) -> nenhuma nova requisição de rede.
    expect(rangeCalls.length).toBe(callsBeforeRemount);
  });

  it("quando a contagem cai de 60 para 30 estando na página 3 (pageSize 20), volta para a página 2, consulta range 20-39 e mantém o pager visível", async () => {
    invoiceTotal = 60;
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <FinancialProvidersPortalPage />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(screen.getByLabelText("Próxima página")).toBeInTheDocument());

    const nextBtn = screen.getByLabelText("Próxima página");
    nextBtn.click();
    await waitFor(() => expect(rangeCalls.some((c) => c.from === 20 && c.to === 39)).toBe(true));
    nextBtn.click();
    await waitFor(() => expect(rangeCalls.some((c) => c.from === 40 && c.to === 59)).toBe(true));
    await waitFor(() => expect(screen.getByText(/41.*60 de 60/)).toBeInTheDocument());

    rangeCalls.length = 0;
    invoiceTotal = 30;
    qc.invalidateQueries({ queryKey: ["provider-invoices"] });

    await waitFor(() => expect(rangeCalls.some((c) => c.from === 20 && c.to === 39)).toBe(true));
    await waitFor(() => expect(screen.getByText(/21.*30 de 30/)).toBeInTheDocument());
    expect(screen.getByLabelText("Próxima página")).toBeInTheDocument();
    expect(screen.getByLabelText("Próxima página")).toBeDisabled();
  });

  it("reduzindo a última página (ex.: de 2 para 1) a contagem e navegação refletem o novo total", async () => {
    invoiceTotal = 25;
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <FinancialProvidersPortalPage />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(screen.getByLabelText("Próxima página")).toBeInTheDocument());
    screen.getByLabelText("Próxima página").click();
    await waitFor(() => expect(screen.getByText(/de 25/)).toBeInTheDocument());
    await waitFor(() => expect(rangeCalls.some((c) => c.from === 20 && c.to === 44)).toBe(true));

    rangeCalls.length = 0;
    invoiceTotal = 15;
    qc.invalidateQueries({ queryKey: ["provider-invoices"] });

    await waitFor(() => expect(rangeCalls.some((c) => c.from === 0 && c.to === 19)).toBe(true));
    await waitFor(() => expect(screen.getByText(/de 15/)).toBeInTheDocument());
    expect(screen.getByLabelText("Próxima página")).toBeDisabled();
  });

  it("ao trocar de conta (account_id), volta para a página 1", async () => {
    invoiceTotal = 60;
    const qc = new QueryClient();
    const { rerender } = render(
      <QueryClientProvider client={qc}>
        <FinancialProvidersPortalPage />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(screen.getByLabelText("Próxima página")).toBeInTheDocument());
    screen.getByLabelText("Próxima página").click();
    await waitFor(() => expect(rangeCalls.some((c) => c.from === 20 && c.to === 39)).toBe(true));
    await waitFor(() => expect(screen.getByText(/21.*40 de 60/)).toBeInTheDocument());

    rangeCalls.length = 0;
    currentUserMock = () => ({ currentUser: { account_id: "acc-2" } });
    rerender(
      <QueryClientProvider client={qc}>
        <FinancialProvidersPortalPage />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(rangeCalls.some((c) => c.from === 0 && c.to === 19)).toBe(true));
    await waitFor(() => expect(screen.getByText(/1.*20 de 60/)).toBeInTheDocument());
  });
});
