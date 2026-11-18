import { describe, it, expect } from "vitest";
import { resolveItemVendaToProductId, PRODUCT_IDS } from "@/lib/sales/itemVendaResolver";
import { looksCoded } from "@/lib/insights/productLabelResolver";

describe("Item da Venda CR unificado", () => {
  it("opção CR l Programa de Aceleração resolve para o mesmo produto CR", () => {
    expect(resolveItemVendaToProductId("opt_1787176918301")).toBe(PRODUCT_IDS.CLINICA_RYKA);
    expect(resolveItemVendaToProductId(PRODUCT_IDS.CLINICA_RYKA)).toBe(PRODUCT_IDS.CLINICA_RYKA);
  });
  it("chave opt_ é tratada como código de produto", () => {
    expect(looksCoded("opt_1787176918301")).toBe(true);
  });
});
