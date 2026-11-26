import { describe, expect, it } from "vitest";
import { orderPayInvoices } from "./payInvoiceOrder";

const list = [{ cycle: 12 }, { cycle: 1 }, { cycle: null }, { cycle: 7 }];

describe("orderPayInvoices", () => {
  it("plano anual vai do ciclo 1 (em cima) ao 12 (embaixo)", () => {
    expect(orderPayInvoices(list, true).map(i => i.cycle)).toEqual([1, 7, 12, null]);
  });
  it("mensal mantém a cobrança mais recente em cima", () => {
    expect(orderPayInvoices(list, false).map(i => i.cycle)).toEqual([12, 7, 1, null]);
  });
});
