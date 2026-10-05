import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { fetchAllRows } from "./fetchAllRows";
import { usePagedList } from "@/hooks/usePagedList";

const fixture = Array.from({ length: 2537 }, (_, i) => ({ id: `id-${i}`, tag: i % 3 === 0 ? "a" : "b" }));

describe("fetchAllRows", () => {
  it("carrega acima do teto antigo de 1000/50000 em lotes, sem duplicar nem truncar (2537 linhas)", async () => {
    const build = vi.fn(async (from: number, to: number) => ({ data: fixture.slice(from, to + 1), error: null }));
    const { data, error } = await fetchAllRows<(typeof fixture)[number]>(build);
    expect(error).toBeNull();
    expect(data).toHaveLength(2537);
    expect(new Set(data.map((r) => r.id)).size).toBe(2537);
    // 1000 (default batchSize) → 3 lotes (1000, 1000, 537) + 1 lote vazio final
    expect(build).toHaveBeenCalledTimes(4);
  });

  it("continua mesmo quando um lote intermediário devolve menos que batchSize (teto do backend, ex. 500)", async () => {
    // Backend simula um teto próprio de 500 por página, mesmo pedindo batchSize=1000.
    const BACKEND_CAP = 500;
    const build = vi.fn(async (from: number, to: number) => {
      const requested = to - from + 1;
      const size = Math.min(requested, BACKEND_CAP);
      return { data: fixture.slice(from, from + size), error: null };
    });
    const { data, error } = await fetchAllRows<(typeof fixture)[number]>(build, { batchSize: 1000 });
    expect(error).toBeNull();
    expect(data).toHaveLength(2537);
    expect(new Set(data.map((r) => r.id)).size).toBe(2537);
    expect(data.map((r) => r.id)).toEqual(fixture.map((r) => r.id));
  });

  it("propaga erro ocorrido no lote 2 (não trata dados parciais como sucesso)", async () => {
    const build = vi.fn(async (from: number, to: number) =>
      from >= 1000 ? { data: null, error: new Error("boom") } : { data: fixture.slice(from, to + 1), error: null },
    );
    const { data, error } = await fetchAllRows<(typeof fixture)[number]>(build);
    expect(error).toBeTruthy();
    expect(data).toHaveLength(1000);
    // Chamadores devem checar `error` antes de usar `data` — o chamador NUNCA deve
    // exibir esses 1000 registros parciais como se fossem o total (2537).
  });

  it("sinaliza explicitamente quando maxRows é atingido, em vez de retornar sucesso parcial", async () => {
    const build = vi.fn(async (from: number, to: number) => ({ data: fixture.slice(from, to + 1), error: null }));
    const { data, error } = await fetchAllRows<(typeof fixture)[number]>(build, { batchSize: 1000, maxRows: 1500 });
    expect(error).toBeTruthy();
    expect((error as any).code).toBe("ROW_LIMIT");
    expect((error as any).truncated).toBe(true);
    // dados parciais vêm junto, mas o `error` deixa claro que não é o total real.
    expect(data.length).toBeGreaterThan(0);
    expect(data.length).toBeLessThan(2537);
  });

  it("ordem com valores empatados é desempatada pelo id (.order(col).order(id)), sem duplicar nem perder linhas", async () => {
    // Todas as linhas empatadas na mesma coluna de ordenação ("tag"); o desempate
    // por id garante um corte de .range() estável entre lotes.
    const tied = Array.from({ length: 120 }, (_, i) => ({ id: `t-${String(i).padStart(3, "0")}`, tag: "same" }));
    const sorted = [...tied].sort((a, b) => (a.tag === b.tag ? a.id.localeCompare(b.id) : 0));
    const build = vi.fn(async (from: number, to: number) => ({ data: sorted.slice(from, to + 1), error: null }));
    const { data, error } = await fetchAllRows<(typeof tied)[number]>(build, { batchSize: 25 });
    expect(error).toBeNull();
    expect(data).toHaveLength(120);
    expect(new Set(data.map((r) => r.id)).size).toBe(120);
    expect(data.map((r) => r.id)).toEqual(sorted.map((r) => r.id));
  });
});

describe("usePagedList com fixture > 1000", () => {
  it("página avançada com IDs distintos e filtro volta à página 1 mantendo total completo", () => {
    const { result, rerender } = renderHook(({ items, key }) => usePagedList(items, { resetKey: key }), {
      initialProps: { items: fixture, key: "all" },
    });
    expect(result.current.totalItems).toBe(2537);
    const p1 = result.current.paginatedItems.map((r) => r.id);
    act(() => result.current.handlePageChange(2));
    const p2 = result.current.paginatedItems.map((r) => r.id);
    expect(p2.some((id) => p1.includes(id))).toBe(false);
    act(() => result.current.handlePageChange(result.current.totalPages));
    expect(result.current.paginatedItems.at(-1)?.id).toBe("id-2536");

    const filtered = fixture.filter((r) => r.tag === "a");
    rerender({ items: filtered, key: "a" });
    expect(result.current.currentPage).toBe(1);
    expect(result.current.totalItems).toBe(filtered.length);
  });
});
