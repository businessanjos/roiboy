import { describe, expect, it, vi } from "vitest";
import { filterProductsByCompany, filterProductsByStatus, filterClientsByCompany, loadCompanyClients } from "@/lib/companyAreaFilters";
import { activityMatchesCompany, buildCompanyActivityScope, contractMatchesCompany } from "@/lib/sales/companyActivityScope";

const products = [
  { id: "cr", name: "CR | Programa de Aceleração", company_id: "anjos" },
  ...["EM", "EC", "EP", "Conselho"].map((name) => ({ id: name, name, company_id: "eternum" })),
  { id: "none", name: "Sem vínculo", company_id: null },
];
const clients = [
  { id: "shared", products: [{ id: "cr" }, { id: "EM" }] },
  { id: "cr-only", products: [{ id: "cr" }] },
  { id: "em-only", products: [{ id: "EM" }] },
  { id: "past-cr", products_history: [{ product_id: "cr", is_active: false }] },
  { id: "contract-cr", contract: { product_id: "cr" } },
  { id: "unassigned", company_name: "Anjos", products: [] },
];

describe("Visualizações de produtos ativos e inativos", () => {
  const catalog = [
    { id: "EM", company_id: "eternum", is_active: true },
    { id: "CR", company_id: "anjos", is_active: true },
    { id: "RMI", company_id: "eternum", is_active: false },
    { id: "REN-RMI", company_id: "eternum", is_active: false },
  ];

  it("mostra somente produtos ativos por padrão", () => {
    expect(filterProductsByStatus(catalog).map((product) => product.id)).toEqual(["EM", "CR"]);
  });

  it("separa os inativos sem alterar nem excluir os produtos", () => {
    const before = structuredClone(catalog);
    expect(filterProductsByStatus(catalog, "inactive").map((product) => product.id)).toEqual(["RMI", "REN-RMI"]);
    expect(catalog).toEqual(before);
  });

  it("mantém o filtro de empresa independente nas duas visualizações", () => {
    expect(filterProductsByCompany(filterProductsByStatus(catalog), "anjos").map((product) => product.id)).toEqual(["CR"]);
    expect(filterProductsByCompany(filterProductsByStatus(catalog, "inactive"), "anjos")).toEqual([]);
    expect(filterProductsByCompany(filterProductsByStatus(catalog, "inactive"), "eternum").map((product) => product.id)).toEqual(["RMI", "REN-RMI"]);
  });
});

describe("Filtros de empresa em produtos e clientes", () => {
  it("Anjos mostra CR e Eternum mostra EM, EC, EP e Conselho", () => {
    expect(filterProductsByCompany(products, "anjos").map((p) => p.name)).toEqual(["CR | Programa de Aceleração"]);
    expect(filterProductsByCompany(products, "eternum").map((p) => p.name)).toEqual(["EM", "EC", "EP", "Conselho"]);
  });
  it("Todas preserva produtos inclusive sem vínculo", () => {
    expect(filterProductsByCompany(products, "all")).toEqual(products);
  });
  it("o mesmo cadastro aparece nas duas empresas sem duplicação", () => {
    const anjos = filterClientsByCompany(clients, products, "anjos");
    const eternum = filterClientsByCompany(clients, products, "eternum");
    expect(anjos.map((c) => c.id)).toEqual(["shared", "cr-only", "past-cr", "contract-cr"]);
    expect(eternum.map((c) => c.id)).toEqual(["shared", "em-only"]);
    expect(anjos[0]).toBe(eternum[0]);
  });
  it("não usa a empresa do próprio cliente para atribuir uma compra", () => {
    expect(filterClientsByCompany([clients[5]], products, "anjos")).toEqual([]);
  });
  it("Todas mantém clientes sem produtos, sem alterar histórico encerrado", () => {
    const before = structuredClone(clients);
    expect(filterClientsByCompany(clients, products, "all")).toEqual(clients);
    filterClientsByCompany(clients, products, "anjos");
    expect(clients).toEqual(before);
  });
  it("filtra todas as páginas antes de contar, preservando ordem e internos fora do total", async () => {
    const rows = Array.from({ length: 405 }, (_, i) => ({ id: String(i), products: [{ id: i % 2 ? "EM" : "cr" }] }));
    const read = vi.fn(async (offset: number, limit: number) => ({ clients: rows.slice(offset, offset + limit), total: 404, internal_ids: ["404"] }));
    const result = await loadCompanyClients(read, products, "anjos");
    expect(read.mock.calls.map(([offset]) => offset)).toEqual([0, 200, 400, 405]);
    expect(result.total).toBe(202);
    expect(result.clients).toHaveLength(203);
    expect(result.clients.slice(-2).map((c) => c.id)).toEqual(["402", "404"]);
  });
  it("uma falha de página não retorna totais parciais", async () => {
    const read = vi.fn().mockResolvedValueOnce({ clients, total: 6 }).mockRejectedValueOnce(new Error("Falha"));
    await expect(loadCompanyClients(read, products, "anjos")).rejects.toThrow("Falha");
  });
});

const scope = buildCompanyActivityScope([
  { id: "cr-sale", company_id: "anjos", client_id: "shared", lead_id: "shared-lead" },
  { id: "em-sale", company_id: "eternum", client_id: "shared", lead_id: "shared-lead" },
  { id: "cr-solo", company_id: "anjos", client_id: "only-cr", lead_id: "only-cr-lead" },
]);
describe("Empresa nas atividades e cancelamentos do painel de vendas", () => {
  it("prioriza a venda explícita mesmo quando cliente e lead compraram das duas empresas", () => {
    expect(activityMatchesCompany({ deal_id: "cr-sale", client_id: "shared" }, "anjos", scope)).toBe(true);
    expect(activityMatchesCompany({ deal_id: "cr-sale", client_id: "shared" }, "eternum", scope)).toBe(false);
  });
  it("não duplica reunião sem negócio vinculado de cliente compartilhado", () => {
    expect(activityMatchesCompany({ client_id: "shared" }, "anjos", scope)).toBe(false);
    expect(activityMatchesCompany({ client_id: "shared" }, "eternum", scope)).toBe(false);
  });
  it("atividades de entidade ligada só a Anjos entram só em Anjos", () => {
    expect(activityMatchesCompany({ client_id: "only-cr" }, "anjos", scope)).toBe(true);
    expect(activityMatchesCompany({ lead_id: "only-cr-lead" }, "eternum", scope)).toBe(false);
  });
  it("negócio não disponível ao usuário não ganha atribuição pelo cliente", () => {
    expect(activityMatchesCompany({ deal_id: "hidden", client_id: "only-cr" }, "anjos", scope)).toBe(false);
  });
  it("Todas preserva inclusive atividades sem vínculo", () => {
    expect(activityMatchesCompany({}, "all", scope)).toBe(true);
  });
  it("cancelamento vinculado usa a empresa histórica da venda e não recategoriza pelo produto", () => {
    const contract = { deal_id: "em-sale", products: { company_id: "anjos" } };
    expect(contractMatchesCompany(contract, "eternum", scope)).toBe(true);
    expect(contractMatchesCompany(contract, "anjos", scope)).toBe(false);
  });
  it("cancelamento sem venda vinculada segue produto, e Todas preserva cancelamentos sem produto", () => {
    expect(contractMatchesCompany({ products: { company_id: "anjos" } }, "anjos", scope)).toBe(true);
    expect(contractMatchesCompany({ products: null }, "all", scope)).toBe(true);
    expect(contractMatchesCompany({ products: null }, "eternum", scope)).toBe(false);
  });
});