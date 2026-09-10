import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { failIf, jsonResult, requireSector } from "../helpers";

export default defineTool({
  name: "products_overview",
  title: "Produtos e base contratada",
  description: "Analisa o catálogo de produtos e sua presença em clientes e contratos ativos.",
  inputSchema: {
    include_inactive: z.boolean().describe("Incluir produtos inativos."),
    limit: z.number().int().min(1).max(200).describe("Máximo de produtos."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ include_inactive, limit }, ctx) => {
    const supabase = await requireSector(ctx, "operacoes");
    let productsQuery = supabase.from("products").select("id, name, description, price, cash_price, installment_price, billing_period, is_active, is_renewal, color").order("name").limit(limit);
    if (!include_inactive) productsQuery = productsQuery.eq("is_active", true);
    const productsResult = await productsQuery; failIf(productsResult.error);
    const products = productsResult.data ?? []; const ids = products.map((product) => product.id);
    let clientProducts: any[] = []; let contracts: any[] = [];
    if (ids.length) {
      const [cpResult, contractResult] = await Promise.all([
        supabase.from("client_products").select("client_id, product_id, is_active").in("product_id", ids).limit(1000),
        supabase.from("client_contracts").select("id, client_id, product_id, status, value, start_date, end_date").in("product_id", ids).limit(1000),
      ]);
      failIf(cpResult.error); failIf(contractResult.error); clientProducts = cpResult.data ?? []; contracts = contractResult.data ?? [];
    }
    return jsonResult({ produtos: products.map((product) => { const related = contracts.filter((c) => c.product_id === product.id); return { ...product, clientes_ativos: clientProducts.filter((cp) => cp.product_id === product.id && cp.is_active).length, contratos_ativos: related.filter((c) => c.status === "active").length, valor_contratado_ativo: related.filter((c) => c.status === "active").reduce((s, c) => s + Number(c.value ?? 0), 0) }; }), observacao: products.length === limit ? `Resultado limitado a ${limit} produtos.` : null });
  },
});
