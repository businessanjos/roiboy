import { describe, it, expect, vi } from "vitest";
import { fetchAllRows } from "@/lib/fetchAllRows";

function makeDataset(total: number) {
  return Array.from({ length: total }, (_, i) => ({ id: i + 1 }));
}

describe("fetchAllRows", () => {
  it("busca todas as linhas em lotes quando há 2500 registros (lotes de 1000)", async () => {
    const dataset = makeDataset(2500);
    const build = vi.fn((from: number, to: number) => {
      return Promise.resolve({ data: dataset.slice(from, to + 1), error: null });
    });

    const { data, error } = await fetchAllRows(build, { batchSize: 1000 });

    expect(error).toBeNull();
    expect(data).toHaveLength(2500);
    expect(data[0]).toEqual({ id: 1 });
    expect(data[2499]).toEqual({ id: 2500 });
    // 1000 + 1000 + 500 + lote vazio final = 4 chamadas
    expect(build).toHaveBeenCalledTimes(4);
  });

  it("propaga erro no 2º lote e não retorna dados parciais como sucesso", async () => {
    const dataset = makeDataset(2500);
    const boom = { message: "falha de rede" };
    const build = vi.fn((from: number, to: number) => {
      if (from === 1000) {
        return Promise.resolve({ data: null, error: boom });
      }
      return Promise.resolve({ data: dataset.slice(from, to + 1), error: null });
    });

    const { data, error } = await fetchAllRows(build, { batchSize: 1000 });

    // contrato atual: erro é retornado (não lançado) e os dados acumulados
    // até o lote com erro não devem ser tratados como resultado completo.
    expect(error).toBe(boom);
    expect(data).toHaveLength(1000); // apenas o 1º lote, que teve sucesso
    expect(build).toHaveBeenCalledTimes(2);
  });

  it("não impõe teto quando maxRows não é definido (simulando 51000 linhas)", async () => {
    const total = 51000;
    const dataset = makeDataset(total);
    const build = vi.fn((from: number, to: number) => {
      return Promise.resolve({ data: dataset.slice(from, to + 1), error: null });
    });

    const { data, error } = await fetchAllRows(build, { batchSize: 1000 });

    expect(error).toBeNull();
    expect(data).toHaveLength(total);
    expect(data[total - 1]).toEqual({ id: total });
  });

  it("retorna erro ROW_LIMIT com dados truncados quando maxRows é definido e excedido", async () => {
    const total = 51000;
    const dataset = makeDataset(total);
    const build = vi.fn((from: number, to: number) => {
      return Promise.resolve({ data: dataset.slice(from, to + 1), error: null });
    });

    const { data, error } = await fetchAllRows(build, { batchSize: 1000, maxRows: 50000 });

    expect(error).not.toBeNull();
    expect((error as any).code).toBe("ROW_LIMIT");
    expect((error as any).truncated).toBe(true);
    expect(data.length).toBeGreaterThan(50000);
  });
});
