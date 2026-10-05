import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/hooks/useCurrentUser", () => ({
  useCurrentUser: () => ({ currentUser: { account_id: "acc-1" } }),
}));

// Lote 1 de contratos volta cheio (1000) e o lote 2 falha.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const q: any = {
        select: () => q,
        eq: () => q,
        not: () => q,
        order: () => q,
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
        range: (from: number) => {
          if (table === "client_contracts" && from > 0) {
            return Promise.resolve({ data: null, error: { message: "falha no lote 2" } });
          }
          const n = table === "client_contracts" ? 1000 : 0;
          return Promise.resolve({
            data: Array.from({ length: n }, (_, i) => ({ id: `c${i}`, client_id: `cl${i}`, value: 10 })),
            error: null,
          });
        },
        then: (r: any) => Promise.resolve({ data: [], error: null }).then(r),
      };
      return q;
    },
  },
}));

import VipClients from "../VipClients";

describe("Clientes VIP — erro no lote 2", () => {
  it("mostra o erro e encerra o carregamento (sem spinner infinito)", async () => {
    render(
      <MemoryRouter>
        <VipClients />
      </MemoryRouter>,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(/falha no lote 2/);
    expect(document.querySelector(".animate-spin")).toBeNull();
  });
});
