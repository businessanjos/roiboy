import { describe, it, expect, vi } from "vitest";
import { fetchInChunks } from "./fetchInChunks";

describe("fetchInChunks", () => {
  it("dedupe, ignora nulos, concatena 2500 ids em lotes de 200 (concorrência 4)", async () => {
    const ids = Array.from({ length: 2500 }, (_, i) => `id-${i % 1250}`); // duplicatas: 1250 únicos
    ids.push(null as any, undefined as any, "" as any);

    const build = vi.fn(async (chunk: string[]) => ({
      data: chunk.map((id) => ({ id })),
      error: null,
    }));

    const result = await fetchInChunks<{ id: string }>(ids, 200, build);

    expect(result).toHaveLength(1250);
    expect(new Set(result.map((r) => r.id)).size).toBe(1250);
    // 1250 ids únicos / 200 por lote = 7 lotes
    expect(build).toHaveBeenCalledTimes(7);
  });

  it("propaga erro ocorrido no lote 3 (throw), sem devolver resultado parcial como sucesso", async () => {
    const ids = Array.from({ length: 2500 }, (_, i) => `id-${i}`); // 2500 únicos -> 13 lotes de 200
    let callCount = 0;

    const build = vi.fn(async (chunk: string[]) => {
      callCount += 1;
      if (callCount === 3) {
        return { data: null, error: new Error("boom no lote 3") };
      }
      return { data: chunk.map((id) => ({ id })), error: null };
    });

    await expect(fetchInChunks<{ id: string }>(ids, 200, build)).rejects.toThrow("boom no lote 3");
  });

  it("retorna lista vazia sem chamar build quando não há ids válidos", async () => {
    const build = vi.fn(async () => ({ data: [], error: null }));
    const result = await fetchInChunks<unknown>([null, undefined, "" as any], 200, build);
    expect(result).toEqual([]);
    expect(build).not.toHaveBeenCalled();
  });
});
