import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { failIf, jsonResult, requireUser, toIso } from "../helpers";

export default defineTool({
  name: "sales_deals",
  title: "Negócios do pipeline",
  description:
    "Lista negócios do pipeline comercial com estágio, valor, responsável, status (aberto/ganho/perdido) e motivo de perda, com resumo agregado.",
  inputSchema: {
    start_date: z.string().nullable().describe("Data inicial de criação (YYYY-MM-DD). null = sem limite."),
    end_date: z.string().nullable().describe("Data final de criação (YYYY-MM-DD). null = sem limite."),
    status: z.enum(["open", "won", "lost", "all"]).describe("Status dos negócios."),
    search: z.string().nullable().describe("Busca parcial no título ou nome do contato. null = sem busca."),
    limit: z.number().int().min(1).max(500).describe("Máximo de negócios retornados (ex.: 100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ start_date, end_date, status, search, limit }, ctx) => {
    const supabase = requireUser(ctx);
    let query = supabase
      .from("deals")
      .select(
        "id, title, status, value, entry_value, received_value, contact_name, contact_email, contact_phone, source, is_renewal, probability, expected_close_date, won_at, lost_at, lost_reason, loss_notes, stage_changed_at, created_at, updated_at, stage_id, pipeline_id, responsible_user_id, sdr_user_id, client_id, deal_stages(name), pipelines(name)",
      )

      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    const startIso = toIso(start_date);
    const endIso = toIso(end_date, true);
    if (startIso) query = query.gte("created_at", startIso);
    if (endIso) query = query.lte("created_at", endIso);
    if (status !== "all") query = query.eq("status", status);
    if (search) query = query.or(`title.ilike.%${search}%,contact_name.ilike.%${search}%`);

    const { data, error } = await query;
    failIf(error);

    const deals = (data ?? []) as any[];
    const sum = (rows: any[]) => rows.reduce((acc, d) => acc + Number(d.value ?? 0), 0);
    const won = deals.filter((d) => d.status === "won");
    const lost = deals.filter((d) => d.status === "lost");

    const byStage = new Map<string, { negocios: number; valor: number }>();
    for (const d of deals) {
      const key = d.deal_stages?.name ?? "Sem estágio";
      const row = byStage.get(key) ?? { negocios: 0, valor: 0 };
      row.negocios += 1;
      row.valor += Number(d.value ?? 0);
      byStage.set(key, row);
    }

    return jsonResult({
      resumo: {
        total: deals.length,
        ganhos: won.length,
        perdidos: lost.length,
        abertos: deals.filter((d) => d.status !== "won" && d.status !== "lost").length,
        valor_total: sum(deals),
        valor_ganho: sum(won),
        taxa_conversao_pct:
          won.length + lost.length > 0 ? Math.round((won.length / (won.length + lost.length)) * 1000) / 10 : 0,
      },
      por_estagio: [...byStage.entries()].map(([estagio, v]) => ({ estagio, ...v })),
      negocios: deals,
    });
  },
});
