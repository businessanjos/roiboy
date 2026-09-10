import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { failIf, jsonResult, requireSector } from "../helpers";

export default defineTool({
  name: "clients_portfolio",
  title: "Carteira de clientes e contratos",
  description: "Analisa clientes, contratos, produtos, vencimentos e renovações da carteira de CS permitida ao usuário.",
  inputSchema: {
    status: z.enum(["active", "paused", "churn_risk", "churned", "no_contract", "all"]).describe("Status do cliente."),
    search: z.string().nullable().describe("Busca pelo nome do cliente ou empresa; null para todos."),
    expiring_before: z.string().nullable().describe("Listar contratos vencendo até YYYY-MM-DD; null para não filtrar."),
    limit: z.number().int().min(1).max(300).describe("Máximo de clientes retornados."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, search, expiring_before, limit }, ctx) => {
    const supabase = await requireSector(ctx, "operacoes");
    let clientsQuery = supabase.from("clients")
      .select("id, full_name, company_name, status, responsible_user_id, stage_id, business_segment, mls_level, contract_start_date, contract_end_date, recent_activity_at, created_at")
      .order("full_name").limit(limit);
    if (status !== "all") clientsQuery = clientsQuery.eq("status", status);
    if (search) clientsQuery = clientsQuery.or(`full_name.ilike.%${search}%,company_name.ilike.%${search}%`);
    const { data: clients, error: clientsError } = await clientsQuery;
    failIf(clientsError);
    const ids = (clients ?? []).map((client) => client.id);
    let contracts: any[] = [];
    if (ids.length) {
      let contractQuery = supabase.from("client_contracts")
        .select("id, client_id, product_id, status, value, currency, start_date, end_date, contract_type, payment_status, installments_count")
        .in("client_id", ids).order("end_date", { ascending: true });
      if (expiring_before) contractQuery = contractQuery.lte("end_date", expiring_before);
      const result = await contractQuery.limit(600);
      failIf(result.error);
      contracts = result.data ?? [];
    }
    const productIds = [...new Set(contracts.map((c) => c.product_id).filter(Boolean))];
    let products: any[] = [];
    if (productIds.length) {
      const result = await supabase.from("products").select("id, name, billing_period, is_active, color").in("id", productIds);
      failIf(result.error);
      products = result.data ?? [];
    }
    const productMap = new Map(products.map((p) => [p.id, p]));
    const rows = (clients ?? []).map((client) => ({
      ...client,
      contratos: contracts.filter((c) => c.client_id === client.id).map((c) => ({ ...c, produto: productMap.get(c.product_id) ?? null })),
    }));
    return jsonResult({
      resumo: {
        clientes: rows.length,
        contratos: contracts.length,
        contratos_ativos: contracts.filter((c) => c.status === "active").length,
        valor_contratos: contracts.reduce((sum, c) => sum + Number(c.value ?? 0), 0),
      },
      clientes: rows,
      observacao: rows.length === limit ? `Resultado limitado a ${limit} clientes; refine os filtros para continuar.` : null,
    });
  },
});
