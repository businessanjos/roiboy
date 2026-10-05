import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePagedList, usePaginationState } from "./usePagedList";

const make = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `id-${i + 1}` }));

describe("usePagedList", () => {
  it("página 2 traz IDs distintos da página 1", () => {
    const data = make(45);
    const { result } = renderHook(() => usePagedList(data));
    const p1 = result.current.items.map((x) => x.id);
    act(() => result.current.handlePageChange(2));
    const p2 = result.current.items.map((x) => x.id);
    expect(p1).toHaveLength(20);
    expect(p2[0]).toBe("id-21");
    expect(p1.some((id) => p2.includes(id))).toBe(false);
  });

  it("última página e limites", () => {
    const data = make(45);
    const { result } = renderHook(() => usePagedList(data));
    act(() => result.current.handlePageChange(99));
    expect(result.current.currentPage).toBe(3);
    expect(result.current.items.map((x) => x.id)).toEqual(["id-41", "id-42", "id-43", "id-44", "id-45"]);
    act(() => result.current.handlePageChange(-5));
    expect(result.current.currentPage).toBe(1);
  });

  it("mudança de critério volta à página 1; array recriado com mesmo critério não reseta", () => {
    let key = "a";
    const { result, rerender } = renderHook(({ d }) => usePagedList(d, { resetKey: key }), { initialProps: { d: make(60) } });
    act(() => result.current.handlePageChange(3));
    rerender({ d: make(60) }); // novo array, mesmo critério
    expect(result.current.currentPage).toBe(3);
    key = "b";
    rerender({ d: make(60) });
    expect(result.current.currentPage).toBe(1);
  });

  it("trocar tamanho volta à página 1", () => {
    const { result } = renderHook(() => usePagedList(make(250)));
    act(() => result.current.handlePageChange(4));
    act(() => result.current.handlePageSizeChange(100));
    expect(result.current.currentPage).toBe(1);
    expect(result.current.items).toHaveLength(100);
    expect(result.current.totalPages).toBe(3);
  });

  it("dados encolhendo ajustam a página; durante loading mantém", () => {
    const { result, rerender } = renderHook(({ d, l }) => usePagedList(d, { isLoading: l }), { initialProps: { d: make(100), l: false } });
    act(() => result.current.handlePageChange(5));
    rerender({ d: [], l: true });
    expect(result.current.currentPage).toBe(5);
    rerender({ d: make(30), l: false });
    expect(result.current.currentPage).toBe(2);
  });

  it("lista vazia é honesta", () => {
    const { result } = renderHook(() => usePagedList([]));
    expect(result.current.totalItems).toBe(0);
    expect(result.current.totalPages).toBe(1);
    expect(result.current.items).toEqual([]);
  });
});

describe("usePaginationState (servidor)", () => {
  it("calcula range acima do teto de 1000 linhas", () => {
    const { result } = renderHook(() => usePaginationState(5321, { defaultPageSize: 100 }));
    act(() => result.current.handlePageChange(54));
    expect(result.current.currentPage).toBe(54);
    expect([result.current.from, result.current.to]).toEqual([5300, 5399]);
  });
});
