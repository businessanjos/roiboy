import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { failIf, jsonResult, requireSector } from "../helpers";

export default defineTool({
  name: "clients_portfolio",
  title: "Carteira de clientes e contratos",
  description:
    "Analisa clientes, contratos, produtos, vencimentos e renovações da carteira de CS permitida ao usuário. Suporta paginação (offset) e modo resumo para analisar a base inteira.",
  inputSchema: {
    status: z.enum(["active", "paused", "churn_risk", "churned", "no_contract", "all"]).describe("Status do cliente."),
    search: z.string().nullable().describe("Busca pelo nome do cliente ou empresa; null para todos."),
    expiring_before: z.string().nullable().describe("Listar contratos vencendo até YYYY-MM-DD; null para não filtrar."),
    limit: z.number().int().min(1).max(1000).describe("Máximo de clientes por página (até 1000)."),
    offset: z.number().int().min(0).describe("Quantos clientes pular (paginação). Comece em 0 e some o limit a cada página."),
    summary_only: z
      .boolean()
      .describe("true = devolve só os totais da base inteira (sem listar clientes), ideal para visão macro antes de paginar."),
    include_contracts: z.boolean().describe("true = inclui os contratos de cada cliente da página."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, search, expiring_before, limit, offset, summary_only, include_contracts }, ctx) => {
    const supabase = await requireSector(ctx, "operacoes");

    const applyClientFilters = (query: any) => {
      let q = query;
      if (status !== "all") q = q.eq("status", status);
      if (search) q = q.or(`full_name.ilike.%${search}%,company_name.ilike.%${search}%`);
      return q;
    };

    // Total real da base (respeitando RLS e filtros), independente da paginação.
    const countResult = await applyClientFilters(
      supabase.from("clients").select("id", { count: "exact", head: true }),
    );
    failIf(countResult.error);
    const totalClientes = countResult.count ?? 0;

    // Contagem por status para a visão macro.
    const statusCounts: Record<string, number> = {};
    if (summary_only || offset === 0) {
      const statuses = ["active", "paused", "churn_risk", "churned", "no_contract"];
      const results = await Promise.all(
        statuses.map(async (s) => {
          let q = supabase.from("clients").select("id", { count: "exact", head: true }).eq("status", s);
          if (search) q = q.or(`full_name.ilike.%${search}%,company_name.ilike.%${search}%`);
          const r = await q;
          return [s, r.error ? 0 : r.count ?? 0] as const;
        }),
      );
      results.forEach(([s, c]) => {
        statusCounts[s] = c;
      });
    }

    if (summary_only) {
      const contractsCount = await supabase
        .from("client_contracts")
        .select("id", { count: "exact", head: true })
        .eq("status", "active");
      failIf(contractsCount.error);
      return jsonResult({
        resumo: {
          clientes_total: totalClientes,
          clientes_por_status: statusCounts,
          contratos_ativos: contractsCount.count ?? 0,
        },
        paginacao: {
          modo: "summary_only",
          proximo_passo: `Chame novamente com summary_only=false, limit=1000 e offset=0, depois offset=1000, 2000... até cobrir ${totalClientes} clientes.`,
        },
      });
    }

    const clientsResult = await applyClientFilters(
      supabase
        .from("clients")
        .select(
          "id, full_name, company_name, status, responsible_user_id, stage_id, business_segment, mls_level, contract_start_date, contract_end_date, recent_activity_at, created_at",
        )
        .order("full_name")
        .range(offset, offset + limit - 1),
    );
    failIf(clientsResult.error);
    const clients = clientsResult.data ?? [];

    const ids = clients.map((client: any) => client.id);
    let contracts: any[] = [];
    if (include_contracts && ids.length) {
      let contractQuery = supabase
        .from("client_contracts")
        .select(
          "id, client_id, product_id, status, value, currency, start_date, end_date, contract_type, payment_status, installments_count",
        )
        .in("client_id", ids)
        .order("end_date", { ascending: true });
      if (expiring_before) contractQuery = contractQuery.lte("end_date", expiring_before);
      const result = await contractQuery.limit(3000);
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

    const rows = clients.map((client: any) => ({
      ...client,
      contratos: include_contracts
        ? contracts
            .filter((c) => c.client_id === client.id)
            .map((c) => ({ ...c, produto: productMap.get(c.product_id) ?? null }))
        : undefined,
    }));

    const nextOffset = offset + clients.length;
    const hasMore = nextOffset < totalClientes;

    return jsonResult({
      resumo: {
        clientes_total: totalClientes,
        clientes_nesta_pagina: rows.length,
        clientes_por_status: offset === 0 ? statusCounts : undefined,
        contratos_nesta_pagina: contracts.length,
        contratos_ativos_nesta_pagina: contracts.filter((c) => c.status === "active").length,
        valor_contratos_nesta_pagina: contracts.reduce((sum, c) => sum + Number(c.value ?? 0), 0),
      },
      paginacao: {
        offset,
        limit,
        proximo_offset: hasMore ? nextOffset : null,
        tem_mais: hasMore,
        instrucao: hasMore
          ? `Ainda faltam ${totalClientes - nextOffset} clientes. Chame de novo com offset=${nextOffset} e o mesmo limit.`
          : "Base completa percorrida.",
      },
      clientes: rows,
    });
  },
});
