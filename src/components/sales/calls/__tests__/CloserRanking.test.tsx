import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/hooks/useCurrentUser", () => ({
  useCurrentUser: () => ({ currentUser: { account_id: "acc-1" } }),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fromMock: any = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: { from: (...a: any[]) => fromMock(...a) },
}));

function setupSupabase() {
  fromMock.mockImplementation((table: string) => {
    if (table === "sales_call_analyses") {
      return {
        select: () => ({
          eq: () => ({
            not: () =>
              Promise.resolve({
                data: [
                  { user_id: "u1", seller_user_id: "u1", call_outcome: "success" },
                  { user_id: "u1", seller_user_id: "u1", call_outcome: "failure" },
                ],
                error: null,
              }),
          }),
        }),
      };
    }
    if (table === "team_roles") {
      return { select: () => ({ or: () => Promise.resolve({ data: [{ id: "role-1" }] }) }) };
    }
    if (table === "user_team_roles") {
      return { select: () => ({ in: () => Promise.resolve({ data: [{ user_id: "u1" }] }) }) };
    }
    if (table === "users") {
      return {
        select: () => ({
          eq: () => ({ in: () => Promise.resolve({ data: [{ id: "u1", name: "Fulano" }] }) }),
        }),
      };
    }
    return { select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) };
  });
}

import { CloserRanking } from "../CloserRanking";

describe("CloserRanking — transição loading → dados sem erro de hooks", () => {
  beforeEach(() => {
    fromMock.mockReset();
    setupSupabase();
  });

  it("renderiza o loading e depois os dados sem warnings de hooks no console", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <CloserRanking />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(screen.getAllByText("Fulano")[0]).toBeInTheDocument());

    const hookErrors = errorSpy.mock.calls.filter((args) =>
      args.some((a) => typeof a === "string" && /Rules of Hooks|rendered more hooks|order of Hooks/i.test(a)),
    );
    expect(hookErrors).toHaveLength(0);
    errorSpy.mockRestore();
  });
});
