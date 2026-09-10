import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { failIf, jsonResult, requireSector, toIso } from "../helpers";

export default defineTool({
  name: "client_success_activity",
  title: "Atividades de Customer Success",
  description: "Resume check-ins e acompanhamentos de clientes por período, canal e tipo, dentro do acesso de Operações.",
  inputSchema: {
    start_date: z.string().describe("Início do período (YYYY-MM-DD)."),
    end_date: z.string().describe("Fim do período (YYYY-MM-DD)."),
    client_id: z.string().uuid().nullable().describe("Cliente específico; null para toda a carteira permitida."),
    limit: z.number().int().min(1).max(300).describe("Máximo de registros de cada tipo."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ start_date, end_date, client_id, limit }, ctx) => {
    const supabase = await requireSector(ctx, "operacoes");
    const start = toIso(start_date) ?? start_date;
    const end = toIso(end_date, true) ?? end_date;
    let checkinsQuery = supabase.from("client_checkins")
      .select("id, client_id, user_id, happened_at, initiated_by, channel, kind, summary, source, message_count")
      .gte("happened_at", start).lte("happened_at", end).order("happened_at", { ascending: false }).limit(limit);
    let followupsQuery = supabase.from("client_followups")
      .select("id, client_id, user_id, type, title, content, created_at")
      .gte("created_at", start).lte("created_at", end).order("created_at", { ascending: false }).limit(limit);
    if (client_id) {
      checkinsQuery = checkinsQuery.eq("client_id", client_id);
      followupsQuery = followupsQuery.eq("client_id", client_id);
    }
    const [checkinsResult, followupsResult] = await Promise.all([checkinsQuery, followupsQuery]);
    failIf(checkinsResult.error); failIf(followupsResult.error);
    const checkins = checkinsResult.data ?? [];
    const followups = followupsResult.data ?? [];
    const porCanal = new Map<string, number>();
    checkins.forEach((row) => porCanal.set(row.channel ?? "não informado", (porCanal.get(row.channel ?? "não informado") ?? 0) + 1));
    return jsonResult({
      periodo: { inicio: start_date, fim: end_date },
      resumo: { checkins: checkins.length, acompanhamentos: followups.length, por_canal: Object.fromEntries(porCanal) },
      checkins,
      acompanhamentos: followups,
      observacao: checkins.length === limit || followups.length === limit ? "Resultado limitado; reduza o período ou informe um cliente." : null,
    });
  },
});
