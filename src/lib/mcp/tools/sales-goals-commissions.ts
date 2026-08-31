import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { failIf, jsonResult, requireUser, toIso } from "../helpers";

export default defineTool({
  name: "sales_goals_commissions",
  title: "Metas e comissões",
  description:
    "Retorna metas comerciais do período e os lançamentos de comissão por negócio (valor, percentual, status de aprovação e pagamento).",
  inputSchema: {
    start_date: z.string().describe("Início do período (YYYY-MM-DD)."),
    end_date: z.string().describe("Fim do período (YYYY-MM-DD)."),
    include_goals: z.boolean().describe("Incluir metas de vendas do período."),
    include_commissions: z.boolean().describe("Incluir lançamentos de comissão do período."),
    limit: z.number().int().min(1).max(500).describe("Máximo de registros por bloco (ex.: 200)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ start_date, end_date, include_goals, include_commissions, limit }, ctx) => {
    const supabase = requireUser(ctx);
    const startIso = toIso(start_date)!;
    const endIso = toIso(end_date, true)!;

    const payload: Record<string, unknown> = { periodo: { inicio: start_date, fim: end_date } };

    if (include_goals) {
      const { data, error } = await supabase
        .from("sales_goals")
        .select("id, client_id, goal_amount, currency, period_start, period_end, created_at")
        .gte("period_end", start_date)
        .lte("period_start", end_date)
        .order("period_start", { ascending: false })
        .limit(limit);
      failIf(error);
      const metas = data ?? [];
      payload.metas = metas;
      payload.metas_total = metas.reduce((acc, g) => acc + Number(g.goal_amount ?? 0), 0);
    }

    if (include_commissions) {
      const { data, error } = await supabase
        .from("commission_deal_entries")
        .select(
          "id, deal_id, deal_title, client_name, deal_value, commission_percent, commission_total, commission_released, commission_pending, commission_status, payment_status, payment_method, approval_status, paid_at, released_at, period_id, plan_id, created_at",
        )
        .gte("created_at", startIso)
        .lte("created_at", endIso)
        .order("created_at", { ascending: false })
        .limit(limit);
      failIf(error);
      const entradas = data ?? [];
      payload.comissoes = entradas;
      payload.comissoes_resumo = {
        lancamentos: entradas.length,
        total: entradas.reduce((a, e) => a + Number(e.commission_total ?? 0), 0),
        liberado: entradas.reduce((a, e) => a + Number(e.commission_released ?? 0), 0),
        pendente: entradas.reduce((a, e) => a + Number(e.commission_pending ?? 0), 0),
        valor_negocios: entradas.reduce((a, e) => a + Number(e.deal_value ?? 0), 0),
      };
    }

    return jsonResult(payload);
  },
});
