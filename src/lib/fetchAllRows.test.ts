import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { fetchAllRows } from "./fetchAllRows";
import { usePagedList } from "@/hooks/usePagedList";

const fixture = Array.from({ length: 2537 }, (_, i) => ({ id: `id-${i}`, tag: i % 3 === 0 ? "a" : "b" }));

describe("fetchAllRows", () => {
  it("carrega acima do teto de 1000 em lotes, sem duplicar nem truncar", async () => {
    const build = vi.fn(async (from: number, to: number) => ({ data: fixture.slice(from, to + 1), error: null }));
    const { data, error } = await fetchAllRows(build);
    expect(error).toBeNull();
    expect(data).toHaveLength(2537);
    expect(new Set(data.map((r) => r.id)).size).toBe(2537);
    expect(build).toHaveBeenCalledTimes(3);
  });

  it("para no erro devolvendo o que já carregou", async () => {
    const build = vi.fn(async (from: number, to: number) =>
      from >= 1000 ? { data: null, error: new Error("x") } : { data: fixture.slice(from, to + 1), error: null },
    );
    const { data, error } = await fetchAllRows(build);
    expect(error).toBeTruthy();
    expect(data).toHaveLength(1000);
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
