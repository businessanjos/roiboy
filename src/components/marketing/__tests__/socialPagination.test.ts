import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePagedList } from "@/hooks/usePagedList";

const make = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `post-${i + 1}` }));

describe("resetKey inclui conta/canal selecionado", () => {
  it("trocar de perfil/canal selecionado volta à página 1", () => {
    let selectedProfileId: string | null = "profile-a";
    const { result, rerender } = renderHook(
      ({ selected }) => usePagedList(make(60), { resetKey: [selected, "current-id"] }),
      { initialProps: { selected: selectedProfileId } },
    );

    act(() => result.current.handlePageChange(3));
    expect(result.current.currentPage).toBe(3);

    selectedProfileId = "profile-b";
    rerender({ selected: selectedProfileId });
    expect(result.current.currentPage).toBe(1);
  });
});
