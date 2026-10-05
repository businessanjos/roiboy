import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const items = Array.from({ length: 45 }, (_, i) => ({
  id: `it-${String(i).padStart(2, "0")}`,
  event_id: "ev-1",
  title: `Item ${i + 1}`,
  description: null,
  status: "pending",
  due_date: null,
  assigned_to: null,
  category: "Geral",
  priority: "medium",
  completed_at: null,
}));
let fetchCount = 0;
const updates: any[] = [];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      const q: any = {
        select: () => q,
        eq: () => q,
        order: () => q,
        range: (from: number, to: number) => {
          if (from === 0) fetchCount++;
          // Atraso para o refetch ficar "em andamento" durante a verificação.
          return new Promise((r) => setTimeout(() => r({ data: items.slice(from, to + 1), error: null }), 5));
        },
        update: (d: any) => {
          updates.push(d);
          return { eq: () => Promise.resolve({ error: null }) };
        },
      };
      return q;
    },
  },
}));

import EventChecklistTab from "../EventChecklistTab";

describe("Checklist do evento — página preservada após ação", () => {
  it("45 itens, página 2, marcar item → continua na página 2", async () => {
    render(<EventChecklistTab eventId="ev-1" accountId="acc-1" />);
    await screen.findByText("Item 1");
    fireEvent.click(screen.getByRole("button", { name: /próxima/i }));
    await screen.findByText("Item 21");

    const before = fetchCount;
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    await waitFor(() => expect(updates.length).toBe(1));
    await waitFor(() => expect(fetchCount).toBeGreaterThan(before));
    // Durante e depois do refetch, a página 2 continua montada.
    expect(screen.getByText("Item 21")).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.getByText("Item 21")).toBeInTheDocument();
    expect(screen.queryByText("Item 1")).toBeNull();
  });
});
