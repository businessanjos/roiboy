import { describe, it, expect } from "vitest";
import { fetchAllInChunks } from "../fetchInChunks";

describe("fetchAllInChunks — pagina o resultado de cada lote", () => {
  it("lote com 1201 registros retorna todos (não para em 1000)", async () => {
    const ids = Array.from({ length: 250 }, (_, i) => `c${i}`);
    const perChunkTotal = 1201;
    const result = await fetchAllInChunks<{ id: string }>(ids, 200, (chunk, from, to) => {
      const total = chunk[0] === "c0" ? perChunkTotal : 5;
      const n = Math.max(0, Math.min(to, total - 1) - from + 1);
      return Promise.resolve({
        data: Array.from({ length: n }, (_, i) => ({ id: `${chunk[0]}-${from + i}` })),
        error: null,
      });
    });
    expect(result.length).toBe(1201 + 5);
    expect(new Set(result.map((r) => r.id)).size).toBe(result.length);
  });

  it("erro na segunda página de um lote propaga (sem dados parciais)", async () => {
    await expect(
      fetchAllInChunks(["a", "b"], 200, (_chunk, from) =>
        Promise.resolve(
          from === 0
            ? { data: Array.from({ length: 1000 }, (_, i) => ({ id: i })), error: null }
            : { data: null, error: { message: "falha lote 2" } },
        ),
      ),
    ).rejects.toEqual({ message: "falha lote 2" });
  });
});
