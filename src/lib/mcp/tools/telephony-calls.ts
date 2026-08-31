import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { failIf, jsonResult, requireUser, secondsToHuman, toIso } from "../helpers";

export default defineTool({
  name: "telephony_calls",
  title: "Ligações 3C Plus",
  description:
    "Lista e resume as ligações da 3C Plus (volume, duração, status, qualificação) por período, vendedor, campanha ou telefone.",
  inputSchema: {
    start_date: z.string().describe("Início do período (YYYY-MM-DD)."),
    end_date: z.string().describe("Fim do período (YYYY-MM-DD)."),
    agent_name: z.string().nullable().describe("Filtra por nome do vendedor/agente (busca parcial). Use null para todos."),
    campaign_name: z.string().nullable().describe("Filtra por campanha (busca parcial). Use null para todas."),
    direction: z.enum(["inbound", "outbound", "all"]).describe("Direção das ligações."),
    limit: z.number().int().min(1).max(500).describe("Quantidade máxima de ligações detalhadas retornadas (ex.: 100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ start_date, end_date, agent_name, campaign_name, direction, limit }, ctx) => {
    const supabase = requireUser(ctx);
    let query = supabase
      .from("threecplus_call_logs")
      .select(
        "id, agent_name, agent_email, call_type, direction, phone, contact_name, campaign_name, status, qualification_name, duration_seconds, wait_seconds, acw_seconds, started_at, connected_at, ended_at",
      )
      .gte("started_at", toIso(start_date)!)
      .lte("started_at", toIso(end_date, true)!)
      .order("started_at", { ascending: false })
      .limit(limit);

    if (agent_name) query = query.ilike("agent_name", `%${agent_name}%`);
    if (campaign_name) query = query.ilike("campaign_name", `%${campaign_name}%`);
    if (direction !== "all") query = query.eq("direction", direction);

    const { data, error } = await query;
    failIf(error);

    const calls = data ?? [];
    const connected = calls.filter((c) => !!c.connected_at);
    const totalDuration = calls.reduce((acc, c) => acc + (c.duration_seconds ?? 0), 0);

    const byAgent = new Map<string, { ligacoes: number; atendidas: number; duracao_segundos: number }>();
    for (const c of calls) {
      const key = c.agent_name ?? "Sem agente";
      const row = byAgent.get(key) ?? { ligacoes: 0, atendidas: 0, duracao_segundos: 0 };
      row.ligacoes += 1;
      if (c.connected_at) row.atendidas += 1;
      row.duracao_segundos += c.duration_seconds ?? 0;
      byAgent.set(key, row);
    }

    return jsonResult({
      periodo: { inicio: start_date, fim: end_date },
      resumo: {
        total_ligacoes: calls.length,
        atendidas: connected.length,
        taxa_atendimento_pct: calls.length ? Math.round((connected.length / calls.length) * 1000) / 10 : 0,
        tempo_total: secondsToHuman(totalDuration),
        duracao_media_segundos: connected.length ? Math.round(totalDuration / connected.length) : 0,
      },
      por_vendedor: [...byAgent.entries()]
        .map(([vendedor, v]) => ({ vendedor, ...v, tempo_total: secondsToHuman(v.duracao_segundos) }))
        .sort((a, b) => b.ligacoes - a.ligacoes),
      ligacoes: calls,
      observacao:
        calls.length === limit
          ? `Resultado truncado em ${limit} ligações. Reduza o período ou filtre por vendedor para uma visão completa.`
          : null,
    });
  },
});
