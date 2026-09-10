import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { failIf, jsonResult, requireSector, toIso } from "../helpers";

export default defineTool({
  name: "audit_overview",
  title: "Auditoria gerencial",
  description: "Consulta movimentações operacionais auditadas sem expor endereços de rede, dispositivos ou credenciais.",
  inputSchema: {
    start_date: z.string().describe("Início do período (YYYY-MM-DD)."),
    end_date: z.string().describe("Fim do período (YYYY-MM-DD)."),
    entity_type: z.string().nullable().describe("Tipo de registro; null para todos."),
    action: z.string().nullable().describe("Ação auditada; null para todas."),
    limit: z.number().int().min(1).max(300).describe("Máximo de movimentações."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ start_date, end_date, entity_type, action, limit }, ctx) => {
    const supabase = await requireSector(ctx, "configuracoes");
    let query = supabase.from("audit_logs")
      .select("id, user_id, user_name, action, entity_type, entity_id, entity_name, created_at")
      .gte("created_at", toIso(start_date) ?? start_date).lte("created_at", toIso(end_date, true) ?? end_date)
      .order("created_at", { ascending: false }).limit(limit);
    if (entity_type) query = query.eq("entity_type", entity_type);
    if (action) query = query.eq("action", action);
    const { data, error } = await query; failIf(error); const logs = data ?? [];
    const byAction = new Map<string, number>(); logs.forEach((row) => byAction.set(row.action, (byAction.get(row.action) ?? 0) + 1));
    return jsonResult({ periodo: { inicio: start_date, fim: end_date }, resumo: { movimentacoes: logs.length, por_acao: Object.fromEntries(byAction) }, movimentacoes: logs, privacidade: "Detalhes livres, e-mail, endereço de rede e identificação do dispositivo foram omitidos.", observacao: logs.length === limit ? `Resultado limitado a ${limit} movimentações.` : null });
  },
});
