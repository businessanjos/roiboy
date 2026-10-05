import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// Fixture com mais de 1000 linhas para expor truncamento silencioso por .limit()
// caso a query pare de usar fetchAllRows/.range() corretamente.
const FIXTURE_SIZE = 2143;
const fixture = Array.from({ length: FIXTURE_SIZE }, (_, i) => ({
  id: `task-${i}`,
  account_id: "acc-1",
  section_id: null,
  column_id: null,
  title: `Tarefa ${i}`,
  description: null,
  assignee_id: null,
  due_date: null,
  priority: "medium" as const,
  status: "pending" as const,
  tags: [],
  custom_fields: {},
  display_order: i,
  is_completed: false,
  completed_at: null,
  created_by: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  media_attachments: null,
  assignee: null,
}));

vi.mock("@/hooks/useCurrentUser", () => ({
  useCurrentUser: () => ({
    currentUser: { id: "u-1", account_id: "acc-1" },
    loading: false,
  }),
}));

// Mock mínimo do query builder do Supabase: encadeia .select/.order/.range e
// resolve com uma fatia da fixture, simulando páginas reais do backend.
function makeSelectQuery() {
  const query: any = {
    select: () => query,
    order: () => query,
    range: (from: number, to: number) => {
      const data = fixture.slice(from, to + 1);
      return Promise.resolve({ data, error: null });
    },
  };
  return query;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "marketing_tasks") return makeSelectQuery();
      throw new Error(`tabela inesperada no mock: ${table}`);
    },
  },
}));

// Importa depois dos mocks acima para garantir que useMarketingTasks use as versões mockadas.
const { useMarketingTasks } = await import("./useMarketingTasks");

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("useMarketingTasks — carga via fetchAllRows (fixture > 1000 linhas)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("carrega todas as tarefas sem truncar nem duplicar, mesmo acima do teto antigo de 1000", async () => {
    const { result } = renderHook(() => useMarketingTasks(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.tasks).toHaveLength(FIXTURE_SIZE);
    expect(new Set(result.current.tasks.map((t) => t.id)).size).toBe(FIXTURE_SIZE);
    expect(result.current.tasks[0].id).toBe("task-0");
    expect(result.current.tasks[FIXTURE_SIZE - 1].id).toBe(`task-${FIXTURE_SIZE - 1}`);
  });
});
