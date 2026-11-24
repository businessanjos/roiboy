import { describe, expect, it } from "vitest";
import { filterDealsByCompany } from "@/lib/sales/companyFilter";
import { applyFilterToDeals } from "@/hooks/usePipelineFilters";
import type { Deal } from "@/hooks/useDeals";

const anjos = "company-anjos";
const eternum = "company-eternum";
const deals = [
  { id: "cr-open", client_id: "same-client", company_id: anjos, status: "open", product: "CR | Programa de Aceleração", value: 1000 },
  { id: "em-open", client_id: "same-client", company_id: eternum, status: "open", product: "EM", value: 2000 },
  { id: "ec-won", client_id: "same-client", company_id: eternum, status: "won", product: "EC", value: 3000 },
  { id: "cr-won", client_id: "same-client", company_id: anjos, status: "won", product: "CR | Programa de Aceleração", value: 4000 },
  { id: "ep-lost", client_id: "same-client", company_id: eternum, status: "lost", product: "EP", value: 5000 },
  { id: "cr-lost", client_id: "same-client", company_id: anjos, status: "lost", product: "CR | Programa de Aceleração", value: 6000 },
  { id: "no-company", client_id: "same-client", company_id: null, status: "open", product: "Conselho", value: 7000 },
];

describe("Filtro de negócios por empresa", () => {
  it("Todas as empresas preserva todas as vendas, inclusive as sem vínculo", () => {
    expect(filterDealsByCompany(deals, "all")).toEqual(deals);
  });

  it("o mesmo cliente pode comprar de Anjos e Eternum sem misturar as vendas", () => {
    expect(filterDealsByCompany(deals, anjos).map((deal) => deal.id)).toEqual(["cr-open", "cr-won", "cr-lost"]);
    expect(filterDealsByCompany(deals, eternum).map((deal) => deal.id)).toEqual(["em-open", "ec-won", "ep-lost"]);
  });

  it.each(["open", "won", "lost"])("a empresa filtra também os negócios %s e seus valores", (status) => {
    const visible = filterDealsByCompany(deals.filter((deal) => deal.status === status), anjos);
    const expected = { open: ["cr-open", 1000], won: ["cr-won", 4000], lost: ["cr-lost", 6000] }[status];
    expect([visible.map((deal) => deal.id).join(), visible.reduce((sum, deal) => sum + deal.value, 0)]).toEqual(expected);
  });

  it("usa a empresa gravada na venda, sem reclassificar pelo nome do produto", () => {
    const historicalSale = [{ id: "historical-cr", product: "CR | Programa de Aceleração", company_id: eternum }];
    expect(filterDealsByCompany(historicalSale, anjos)).toEqual([]);
    expect(filterDealsByCompany(historicalSale, eternum)).toEqual(historicalSale);
  });

  it("não atribui empresa às vendas sem vínculo", () => {
    const unassigned = [{ id: "null", company_id: null }, { id: "missing" }];
    expect(filterDealsByCompany(unassigned, anjos)).toEqual([]);
    expect(filterDealsByCompany(unassigned, eternum)).toEqual([]);
  });

  it("mantém somente os negócios já disponíveis para o usuário, sem modificar dados", () => {
    const visibleToUser = [deals[0], deals[1]].filter((deal) => deal !== undefined);
    const before = structuredClone(visibleToUser);
    expect(filterDealsByCompany(visibleToUser, anjos).map((deal) => deal.id)).toEqual(["cr-open"]);
    expect(visibleToUser).toEqual(before);
  });

  it("combina empresa, vendedor e pesquisa sem substituir os filtros existentes", () => {
    const scoped = [
      { id: "match", company_id: anjos, title: "Cliente Maria", responsible_user_id: "seller-1" },
      { id: "other-company", company_id: eternum, title: "Cliente Maria", responsible_user_id: "seller-1" },
      { id: "other-seller", company_id: anjos, title: "Cliente Maria", responsible_user_id: "seller-2" },
      { id: "other-client", company_id: anjos, title: "Cliente Ana", responsible_user_id: "seller-1" },
    ] as unknown as Deal[];
    const result = applyFilterToDeals(filterDealsByCompany(scoped, anjos), { type: "salesperson", id: "seller-1", name: "Vendedor" }, "Maria");
    expect(result.map((deal) => deal.id)).toEqual(["match"]);
  });
});