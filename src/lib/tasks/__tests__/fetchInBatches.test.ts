import { describe, it, expect, vi } from "vitest";
import { fetchInBatches } from "../fetchInBatches";

describe("fetchInBatches", () => {
  it("divide 1201 ids em lotes de 150 (9 chamadas) e junta os resultados", async () => {
    const ids = Array.from({ length: 1201 }, (_, i) => `id-${i}`);
    const fetchBatch = vi.fn(async (batchIds: string[]) => ({
      data: batchIds.map((id) => ({ id })),
      error: null,
    }));

    const result = await fetchInBatches(ids, 150, fetchBatch);

    expect(fetchBatch).toHaveBeenCalledTimes(9);
    // 8 lotes de 150 + 1 lote de 1
    expect(fetchBatch.mock.calls[0][0]).toHaveLength(150);
    expect(fetchBatch.mock.calls[8][0]).toHaveLength(1);
    expect(result).toHaveLength(1201);
  });

  it("propaga (lança) o erro de um lote e interrompe os lotes seguintes", async () => {
    const ids = Array.from({ length: 310 }, (_, i) => `id-${i}`);
    let callCount = 0;
    const fetchBatch = vi.fn(async (batchIds: string[]) => {
      callCount += 1;
      if (callCount === 2) {
        return { data: null, error: new Error("falha no segundo lote") };
      }
      return { data: batchIds.map((id) => ({ id })), error: null };
    });

    await expect(fetchInBatches(ids, 150, fetchBatch)).rejects.toThrow("falha no segundo lote");
    // 1º lote ok, 2º lote falhou: não deve tentar o 3º
    expect(fetchBatch).toHaveBeenCalledTimes(2);
  });

  it("retorna lista vazia quando não há ids (nenhuma chamada)", async () => {
    const fetchBatch = vi.fn();
    const result = await fetchInBatches([], 150, fetchBatch);
    expect(fetchBatch).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });
});
