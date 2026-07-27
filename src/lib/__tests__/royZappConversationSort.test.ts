import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  compareConversationsByRecency,
  type SortableConversation,
} from "@/lib/royZappConversationSort";

const sort = (rows: SortableConversation[]) => [...rows].sort(compareConversationsByRecency);

describe("ordenação da lista de conversas do ROY zAPP", () => {
  it("ordena pela última mensagem (desc), ignorando updated_at do assignment", () => {
    const rows: (SortableConversation & { updated_at: string })[] = [
      { id: "a", lastMessageAt: "2026-07-27T17:07:00Z", updated_at: "2026-07-27T18:00:00Z" },
      { id: "sabrina", lastMessageAt: "2026-07-27T17:20:00Z", updated_at: "2026-07-21T10:00:00Z" },
      { id: "c", lastMessageAt: "2026-07-27T17:26:00Z", updated_at: "2026-07-22T10:00:00Z" },
    ];
    expect(sort(rows).map((r) => r.id)).toEqual(["c", "sabrina", "a"]);
  });

  it("mantém fixadas no topo mesmo com mensagem mais antiga", () => {
    const rows: SortableConversation[] = [
      { id: "nova", lastMessageAt: "2026-07-27T18:00:00Z" },
      { id: "fixada", lastMessageAt: "2026-07-01T09:00:00Z", isPinned: true },
    ];
    expect(sort(rows).map((r) => r.id)).toEqual(["fixada", "nova"]);
  });

  it("usa fallback (created_at) quando não há última mensagem", () => {
    const rows: SortableConversation[] = [
      { id: "sem-msg", fallbackAt: "2026-07-27T19:00:00Z" },
      { id: "com-msg", lastMessageAt: "2026-07-27T18:00:00Z" },
    ];
    expect(sort(rows).map((r) => r.id)).toEqual(["sem-msg", "com-msg"]);
  });

  it("desempata de forma determinística", () => {
    const rows: SortableConversation[] = [
      { id: "a", lastMessageAt: "2026-07-27T18:00:00Z" },
      { id: "b", lastMessageAt: "2026-07-27T18:00:00Z" },
    ];
    expect(sort(rows).map((r) => r.id)).toEqual(sort([...rows].reverse()).map((r) => r.id));
  });
});

describe("query de assignments", () => {
  const source = readFileSync(
    path.resolve(__dirname, "../../hooks/useZappConversations.ts"),
    "utf8"
  );

  it("busca ordenando pela última mensagem da conversa", () => {
    const orders = source.match(/\.order\([^)]*\)/g) || [];
    const byLastMessage = orders.filter((o) =>
      o.includes('"last_message_at"') && o.includes('referencedTable: "zapp_conversation"')
    );
    // Duas queries de assignments (fetchData e fetchAssignmentsForDepartment)
    expect(byLastMessage.length).toBeGreaterThanOrEqual(2);
  });

  it("nunca usa apenas updated_at como ordenação primária dos assignments", () => {
    const limited = source.match(/\.order\([\s\S]{0,400}?\.limit\(1000\)/g) || [];
    expect(limited.length).toBeGreaterThanOrEqual(2);
    for (const block of limited) {
      expect(block.indexOf('"last_message_at"')).toBeLessThan(block.indexOf('"updated_at"'));
    }
  });
});
